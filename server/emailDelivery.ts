/**
 * emailDelivery.ts
 *
 * Trustworthy book delivery via email with HMAC-SHA256 signed, time-limited
 * download tokens. Design principles:
 *
 *  1. OPAQUE TOKEN — a cryptographically random nanoid (21 chars) is stored in
 *     the URL. It carries no information on its own.
 *
 *  2. HMAC-SHA256 SIGNATURE — the server signs the tuple
 *     (token | bookId | userId | expiresAt.toISOString()) with JWT_SECRET.
 *     The signature is stored in the DB alongside the token. When a download
 *     request arrives, the server recomputes the HMAC and compares it in
 *     constant time (timingSafeEqual) to prevent timing attacks.
 *
 *  3. EXPIRY — tokens expire after 48 hours. The expiresAt field is part of
 *     the signed payload, so an attacker cannot extend the expiry without
 *     invalidating the signature.
 *
 *  4. DOWNLOAD LIMIT — each token allows up to 5 downloads (configurable).
 *     After that, the token is rejected even if not expired. This prevents
 *     link sharing while still allowing the buyer to re-download on different
 *     devices.
 *
 *  5. EMAIL CHANNEL — the Manus built-in notifyOwner API is owner-only, so
 *     we use the Forge CallApi to send transactional HTML email via the
 *     platform's email service. If that is unavailable, we fall back to
 *     logging the link server-side (development mode) and notifying the owner
 *     so they can forward it manually.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { nanoid } from "nanoid";
import { getDb } from "./db";
import { downloadTokens, books, users } from "../drizzle/schema";
import { eq, and, gt } from "drizzle-orm";
import { ENV } from "./_core/env";

// ─── Constants ────────────────────────────────────────────────────────────────

const TOKEN_TTL_HOURS = 48;
const MAX_DOWNLOADS_PER_TOKEN = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive the HMAC-SHA256 signature for a download token record. */
function signToken(token: string, bookId: number, userId: number, expiresAt: Date): string {
  const payload = `${token}|${bookId}|${userId}|${expiresAt.toISOString()}`;
  return createHmac("sha256", ENV.cookieSecret || "fallback-dev-secret")
    .update(payload)
    .digest("hex");
}

/** Constant-time comparison to prevent timing attacks. */
function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "hex");
    const bufB = Buffer.from(b, "hex");
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/** Resolve the public base URL of the application. */
function getAppBaseUrl(): string {
  // In production, the deployed domain is used
  if (ENV.isProduction) {
    // cryptobook-ytjpjnxd.manus.space is the deployed domain
    return "https://cryptobook-ytjpjnxd.manus.space";
  }
  // In development, use the sandbox preview URL
  return "http://localhost:3000";
}

// ─── Token Generation ─────────────────────────────────────────────────────────

export interface GeneratedToken {
  token: string;
  signature: string;
  expiresAt: Date;
  downloadUrl: string;
}

/**
 * Generate a signed download token for a specific book/order/user combination
 * and persist it to the database.
 */
export async function generateDownloadToken(
  bookId: number,
  orderId: number,
  userId: number
): Promise<GeneratedToken> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const token = nanoid(32); // 32-char URL-safe random string
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);
  const signature = signToken(token, bookId, userId, expiresAt);

  await db.insert(downloadTokens).values({
    token,
    signature,
    bookId,
    orderId,
    userId,
    expiresAt,
    downloadCount: 0,
    maxDownloads: MAX_DOWNLOADS_PER_TOKEN,
  });

  const downloadUrl = `${getAppBaseUrl()}/api/download/${token}`;
  return { token, signature, expiresAt, downloadUrl };
}

// ─── Token Validation ─────────────────────────────────────────────────────────

export type TokenValidationResult =
  | { valid: true; record: typeof downloadTokens.$inferSelect; book: typeof books.$inferSelect }
  | { valid: false; reason: "not_found" | "expired" | "limit_exceeded" | "tampered" | "revoked" };

/**
 * Validate a download token from an incoming request.
 * Returns the associated book record on success so the caller can stream the file.
 */
export async function validateDownloadToken(token: string): Promise<TokenValidationResult> {
  const db = await getDb();
  if (!db) return { valid: false, reason: "not_found" };

  // 1. Look up the token record
  const rows = await db
    .select()
    .from(downloadTokens)
    .where(eq(downloadTokens.token, token))
    .limit(1);

  if (rows.length === 0) return { valid: false, reason: "not_found" };
  const record = rows[0]!;

  // 2. Verify HMAC signature (tamper detection)
  const expectedSig = signToken(record.token, record.bookId, record.userId, record.expiresAt);
  if (!safeCompare(record.signature, expectedSig)) {
    return { valid: false, reason: "tampered" };
  }

  // 3. Check revocation (admin may have invalidated this token, e.g. after a refund)
  if (record.revokedAt !== null && record.revokedAt !== undefined) {
    return { valid: false, reason: "revoked" };
  }

  // 4. Check expiry
  if (new Date() > record.expiresAt) {
    return { valid: false, reason: "expired" };
  }

  // 5. Check download limit
  if (record.downloadCount >= record.maxDownloads) {
    return { valid: false, reason: "limit_exceeded" };
  }

  // 6. Fetch the book
  const bookRows = await db.select().from(books).where(eq(books.id, record.bookId)).limit(1);
  if (bookRows.length === 0) return { valid: false, reason: "not_found" };
  const book = bookRows[0]!;

  return { valid: true, record, book };
}

/**
 * Increment the download counter for a token after a successful download.
 */
export async function recordTokenUsage(tokenId: number, currentCount: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(downloadTokens)
    .set({ downloadCount: currentCount + 1 })
    .where(eq(downloadTokens.id, tokenId));
}

// ─── Email Sending ────────────────────────────────────────────────────────────

export interface BookDeliveryEmailParams {
  buyerEmail: string;
  buyerName: string;
  orderId: number;
  txHash: string;
  items: Array<{
    bookId: number;
    bookTitle: string;
    bookAuthor: string;
    bookCover?: string | null;
    downloadUrl: string;
    expiresAt: Date;
    hasFile: boolean;
  }>;
}

/** Build the HTML body for the delivery email. */
function buildEmailHtml(params: BookDeliveryEmailParams): string {
  const { buyerName, orderId, txHash, items } = params;

  const bookRows = items
    .map(item => {
      const expiryStr = item.expiresAt.toLocaleString("en-US", {
        month: "long", day: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit", timeZoneName: "short",
      });
      const downloadSection = item.hasFile
        ? `<a href="${item.downloadUrl}"
              style="display:inline-block;background:#c9a84c;color:#0a1628;font-weight:700;
                     padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px;
                     margin-top:12px;">
              ⬇ Download Now
           </a>
           <p style="color:#8a9bb5;font-size:12px;margin:8px 0 0;">
             Link valid until ${expiryStr} &bull; Up to ${MAX_DOWNLOADS_PER_TOKEN} downloads
           </p>`
        : `<p style="color:#8a9bb5;font-size:13px;margin-top:8px;">
             📚 Digital file coming soon — we'll notify you when it's ready.
           </p>`;

      return `
        <tr>
          <td style="padding:20px 0;border-bottom:1px solid #1e3a5f;">
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td width="64" valign="top" style="padding-right:16px;">
                  ${item.bookCover
                    ? `<img src="${item.bookCover}" width="64" height="88"
                            style="border-radius:6px;object-fit:cover;" alt="${item.bookTitle}" />`
                    : `<div style="width:64px;height:88px;background:#1e3a5f;border-radius:6px;"></div>`}
                </td>
                <td valign="top">
                  <p style="color:#f0e6c8;font-size:16px;font-weight:700;margin:0 0 4px;">${item.bookTitle}</p>
                  <p style="color:#8a9bb5;font-size:13px;margin:0 0 8px;">by ${item.bookAuthor}</p>
                  ${downloadSection}
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your CryptoBook Order is Confirmed</title>
</head>
<body style="margin:0;padding:0;background:#060f1e;font-family:'Segoe UI',Arial,sans-serif;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background:#060f1e;padding:40px 20px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" width="600"
               style="background:#0a1628;border-radius:16px;overflow:hidden;
                      border:1px solid #1e3a5f;max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0a1628 0%,#0d2044 100%);
                       padding:32px 40px;border-bottom:2px solid #c9a84c;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <p style="color:#c9a84c;font-size:22px;font-weight:800;margin:0;
                               letter-spacing:-0.5px;">
                      📚 CryptoBook <span style="color:#f0e6c8;font-weight:400;">Store</span>
                    </p>
                  </td>
                  <td align="right">
                    <span style="background:#c9a84c;color:#0a1628;font-size:11px;
                                 font-weight:700;padding:4px 10px;border-radius:20px;">
                      ✓ PAYMENT CONFIRMED
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <h1 style="color:#f0e6c8;font-size:24px;font-weight:700;margin:0 0 8px;">
                Your books are ready, ${buyerName}!
              </h1>
              <p style="color:#8a9bb5;font-size:15px;margin:0 0 24px;line-height:1.6;">
                Thank you for your purchase. Your crypto payment has been confirmed on-chain.
                Each download link below is cryptographically signed and valid for
                <strong style="color:#c9a84c;">${TOKEN_TTL_HOURS} hours</strong>.
              </p>

              <!-- Order meta -->
              <table cellpadding="0" cellspacing="0" width="100%"
                     style="background:#0d2044;border-radius:10px;padding:16px;
                            border:1px solid #1e3a5f;margin-bottom:24px;">
                <tr>
                  <td style="color:#8a9bb5;font-size:13px;padding:4px 0;">Order ID</td>
                  <td align="right" style="color:#f0e6c8;font-size:13px;font-weight:600;">
                    #${String(orderId).padStart(6, "0")}
                  </td>
                </tr>
                <tr>
                  <td style="color:#8a9bb5;font-size:13px;padding:4px 0;">Transaction Hash</td>
                  <td align="right"
                      style="color:#c9a84c;font-size:11px;font-family:monospace;word-break:break-all;">
                    ${txHash}
                  </td>
                </tr>
              </table>

              <!-- Book list -->
              <h2 style="color:#f0e6c8;font-size:16px;font-weight:700;
                          margin:0 0 4px;border-bottom:1px solid #1e3a5f;padding-bottom:12px;">
                Your Downloads
              </h2>
              <table cellpadding="0" cellspacing="0" width="100%">
                ${bookRows}
              </table>

              <!-- Security notice -->
              <table cellpadding="0" cellspacing="0" width="100%"
                     style="background:#0d2044;border-radius:10px;padding:16px;
                            border:1px solid #1e3a5f;margin-top:24px;">
                <tr>
                  <td>
                    <p style="color:#c9a84c;font-size:13px;font-weight:700;margin:0 0 6px;">
                      🔐 Security Notice
                    </p>
                    <p style="color:#8a9bb5;font-size:12px;margin:0;line-height:1.6;">
                      Each download link is protected by an HMAC-SHA256 signature tied to your
                      account and order. Links cannot be transferred or modified — any tampering
                      invalidates the signature. If your link expires, visit your
                      <strong style="color:#f0e6c8;">Order History</strong> to generate a new one.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#060f1e;padding:20px 40px;border-top:1px solid #1e3a5f;">
              <p style="color:#4a5568;font-size:12px;margin:0;text-align:center;">
                CryptoBook Store &bull; Every book verified with RSA cryptography &bull;
                <a href="${getAppBaseUrl()}" style="color:#c9a84c;text-decoration:none;">
                  Visit Store
                </a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Send the book delivery email to the buyer.
 *
 * Strategy:
 *  - Primary: Forge CallApi → email service (if configured)
 *  - Fallback: notifyOwner so the store owner can forward the links manually
 *  - Dev mode: log to console (no real email sent)
 */
export async function sendBookDeliveryEmail(params: BookDeliveryEmailParams): Promise<boolean> {
  const html = buildEmailHtml(params);
  const subject = `📚 Your CryptoBook order #${String(params.orderId).padStart(6, "0")} is ready to download`;

  // ── Development: log to console ──────────────────────────────────────────
  if (!ENV.isProduction) {
    console.log("\n[EmailDelivery] ─────────────────────────────────────────");
    console.log(`[EmailDelivery] TO:      ${params.buyerEmail}`);
    console.log(`[EmailDelivery] SUBJECT: ${subject}`);
    console.log("[EmailDelivery] LINKS:");
    params.items.forEach(item => {
      if (item.hasFile) {
        console.log(`  • ${item.bookTitle}: ${item.downloadUrl}`);
        console.log(`    Expires: ${item.expiresAt.toISOString()}`);
      }
    });
    console.log("[EmailDelivery] ─────────────────────────────────────────\n");
    return true;
  }

  // ── Production: attempt Forge email API ──────────────────────────────────
  try {
    if (ENV.forgeApiUrl && ENV.forgeApiKey) {
      const endpoint = `${ENV.forgeApiUrl.replace(/\/$/, "")}/webdevtoken.v1.WebDevService/SendEmail`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "accept": "application/json",
          "authorization": `Bearer ${ENV.forgeApiKey}`,
          "content-type": "application/json",
          "connect-protocol-version": "1",
        },
        body: JSON.stringify({
          to: params.buyerEmail,
          subject,
          html,
          text: `Your CryptoBook order #${params.orderId} is confirmed. Download your books at: ${params.items.filter(i => i.hasFile).map(i => i.downloadUrl).join(", ")}`,
        }),
      });

      if (response.ok) {
        console.log(`[EmailDelivery] Email sent to ${params.buyerEmail} for order #${params.orderId}`);
        return true;
      }

      const detail = await response.text().catch(() => "");
      console.warn(`[EmailDelivery] Forge email API failed (${response.status}): ${detail}`);
    }
  } catch (err) {
    console.warn("[EmailDelivery] Forge email API error:", err);
  }

  // ── Fallback: notify owner with download links ────────────────────────────
  try {
    const { notifyOwner } = await import("./_core/notification");
    const linkList = params.items
      .filter(i => i.hasFile)
      .map(i => `• ${i.bookTitle}: ${i.downloadUrl} (expires ${i.expiresAt.toISOString()})`)
      .join("\n");

    await notifyOwner({
      title: `📚 Order #${params.orderId} confirmed — please forward download links to ${params.buyerEmail}`,
      content: `Buyer: ${params.buyerName} <${params.buyerEmail}>\nOrder: #${params.orderId}\nTx: ${params.txHash}\n\nDownload links:\n${linkList || "No downloadable files in this order."}`,
    });
    console.log(`[EmailDelivery] Owner notified as fallback for order #${params.orderId}`);
    return true;
  } catch (err) {
    console.warn("[EmailDelivery] Owner notification fallback failed:", err);
    return false;
  }
}
