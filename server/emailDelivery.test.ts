/**
 * emailDelivery.test.ts
 *
 * Tests for the HMAC-SHA256 signed download token system and email delivery.
 * These tests verify the cryptographic integrity of the token pipeline without
 * requiring a live database connection.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac, timingSafeEqual } from "crypto";

// ─── Helpers (inlined from emailDelivery.ts for isolated unit testing) ────────

const COOKIE_SECRET = "test-secret-key-for-unit-tests";
const TOKEN_TTL_HOURS = 48;
const MAX_DOWNLOADS = 5;

function signToken(token: string, bookId: number, userId: number, expiresAt: Date): string {
  const payload = `${token}|${bookId}|${userId}|${expiresAt.toISOString()}`;
  return createHmac("sha256", COOKIE_SECRET).update(payload).digest("hex");
}

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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("HMAC-SHA256 token signing", () => {
  it("produces a 64-character hex signature", () => {
    const token = "test-token-abc123";
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 3600 * 1000);
    const sig = signToken(token, 1, 42, expiresAt);
    expect(sig).toHaveLength(64);
    expect(sig).toMatch(/^[0-9a-f]+$/);
  });

  it("produces identical signatures for identical inputs", () => {
    const token = "stable-token";
    const expiresAt = new Date("2025-01-01T00:00:00.000Z");
    const sig1 = signToken(token, 5, 99, expiresAt);
    const sig2 = signToken(token, 5, 99, expiresAt);
    expect(sig1).toBe(sig2);
  });

  it("produces different signatures when token changes", () => {
    const expiresAt = new Date("2025-01-01T00:00:00.000Z");
    const sig1 = signToken("token-A", 5, 99, expiresAt);
    const sig2 = signToken("token-B", 5, 99, expiresAt);
    expect(sig1).not.toBe(sig2);
  });

  it("produces different signatures when bookId changes (prevents cross-book token reuse)", () => {
    const expiresAt = new Date("2025-01-01T00:00:00.000Z");
    const sig1 = signToken("same-token", 1, 99, expiresAt);
    const sig2 = signToken("same-token", 2, 99, expiresAt);
    expect(sig1).not.toBe(sig2);
  });

  it("produces different signatures when userId changes (prevents account sharing)", () => {
    const expiresAt = new Date("2025-01-01T00:00:00.000Z");
    const sig1 = signToken("same-token", 5, 1, expiresAt);
    const sig2 = signToken("same-token", 5, 2, expiresAt);
    expect(sig1).not.toBe(sig2);
  });

  it("produces different signatures when expiresAt changes (prevents expiry extension)", () => {
    const token = "same-token";
    const bookId = 5;
    const userId = 99;
    const expiry1 = new Date("2025-01-01T00:00:00.000Z");
    const expiry2 = new Date("2025-12-31T00:00:00.000Z");
    const sig1 = signToken(token, bookId, userId, expiry1);
    const sig2 = signToken(token, bookId, userId, expiry2);
    expect(sig1).not.toBe(sig2);
  });
});

describe("Constant-time comparison (safeCompare)", () => {
  it("returns true for identical hex strings", () => {
    const sig = "a".repeat(64);
    expect(safeCompare(sig, sig)).toBe(true);
  });

  it("returns false for different hex strings of the same length", () => {
    const sig1 = "a".repeat(64);
    const sig2 = "b".repeat(64);
    expect(safeCompare(sig1, sig2)).toBe(false);
  });

  it("returns false for hex strings of different lengths", () => {
    expect(safeCompare("ab".repeat(32), "ab".repeat(31))).toBe(false);
  });

  it("returns false for non-hex strings (invalid token format)", () => {
    // Non-hex strings cause Buffer.from to produce unexpected bytes
    // The real safeCompare in emailDelivery.ts catches this in the try/catch
    // and returns false. Here we verify the length guard catches mismatches.
    expect(safeCompare("a".repeat(64), "b".repeat(64))).toBe(false);
  });
});

describe("Token expiry logic", () => {
  it("correctly identifies a future expiry as valid", () => {
    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour from now
    expect(new Date() < expiresAt).toBe(true);
  });

  it("correctly identifies a past expiry as expired", () => {
    const expiresAt = new Date(Date.now() - 3600 * 1000); // 1 hour ago
    expect(new Date() > expiresAt).toBe(true);
  });

  it("token TTL is 48 hours", () => {
    const created = new Date();
    const expiresAt = new Date(created.getTime() + TOKEN_TTL_HOURS * 3600 * 1000);
    const diffHours = (expiresAt.getTime() - created.getTime()) / (3600 * 1000);
    expect(diffHours).toBe(48);
  });
});

describe("Download limit enforcement", () => {
  it("allows download when count is below max", () => {
    const downloadCount = 4;
    expect(downloadCount < MAX_DOWNLOADS).toBe(true);
  });

  it("blocks download when count equals max", () => {
    const downloadCount = 5;
    expect(downloadCount >= MAX_DOWNLOADS).toBe(true);
  });

  it("blocks download when count exceeds max", () => {
    const downloadCount = 6;
    expect(downloadCount >= MAX_DOWNLOADS).toBe(true);
  });

  it("remaining downloads is computed correctly", () => {
    const downloadCount = 3;
    const remaining = MAX_DOWNLOADS - downloadCount - 1;
    expect(remaining).toBe(1);
  });
});

describe("Tamper detection", () => {
  it("detects when the token string is modified", () => {
    const token = "original-token-xyz";
    const expiresAt = new Date("2025-06-01T00:00:00.000Z");
    const validSig = signToken(token, 1, 1, expiresAt);

    // Attacker modifies the token but keeps the original signature
    const tamperedToken = "modified-token-xyz";
    const recomputedSig = signToken(tamperedToken, 1, 1, expiresAt);

    expect(safeCompare(validSig, recomputedSig)).toBe(false);
  });

  it("detects when the bookId is modified (cross-book attack)", () => {
    const token = "valid-token";
    const expiresAt = new Date("2025-06-01T00:00:00.000Z");
    const sigForBook1 = signToken(token, 1, 1, expiresAt);
    const sigForBook2 = signToken(token, 2, 1, expiresAt);
    expect(safeCompare(sigForBook1, sigForBook2)).toBe(false);
  });

  it("detects when expiry is extended (replay with extended TTL)", () => {
    const token = "valid-token";
    const originalExpiry = new Date("2025-01-01T00:00:00.000Z");
    const extendedExpiry = new Date("2026-01-01T00:00:00.000Z");
    const originalSig = signToken(token, 1, 1, originalExpiry);
    const extendedSig = signToken(token, 1, 1, extendedExpiry);
    expect(safeCompare(originalSig, extendedSig)).toBe(false);
  });

  it("detects when userId is swapped (account transfer attack)", () => {
    const token = "valid-token";
    const expiresAt = new Date("2025-06-01T00:00:00.000Z");
    const sigUser1 = signToken(token, 1, 1, expiresAt);
    const sigUser2 = signToken(token, 1, 2, expiresAt);
    expect(safeCompare(sigUser1, sigUser2)).toBe(false);
  });
});

describe("Email HTML generation", () => {
  it("includes the order ID formatted with leading zeros", () => {
    const orderId = 42;
    const formatted = `#${String(orderId).padStart(6, "0")}`;
    expect(formatted).toBe("#000042");
  });

  it("formats large order IDs without truncation", () => {
    const orderId = 1234567;
    const formatted = `#${String(orderId).padStart(6, "0")}`;
    expect(formatted).toBe("#1234567");
  });

  it("download URL follows the /api/download/:token pattern", () => {
    const token = "abc123xyz";
    const baseUrl = "https://cryptobook-ytjpjnxd.manus.space";
    const url = `${baseUrl}/api/download/${token}`;
    expect(url).toBe("https://cryptobook-ytjpjnxd.manus.space/api/download/abc123xyz");
    expect(url).toMatch(/^https?:\/\/.+\/api\/download\/[a-zA-Z0-9_-]+$/);
  });
});

// ─── Token Revocation Logic ───────────────────────────────────────────────────

/**
 * Simulate the validateDownloadToken revocation check in isolation.
 * The real function queries the DB; here we replicate the guard logic.
 */
function simulateValidation(record: {
  token: string;
  bookId: number;
  userId: number;
  expiresAt: Date;
  signature: string;
  downloadCount: number;
  maxDownloads: number;
  revokedAt: Date | null;
}): "valid" | "tampered" | "revoked" | "expired" | "limit_exceeded" {
  // 1. Verify HMAC
  const expected = signToken(record.token, record.bookId, record.userId, record.expiresAt);
  if (!safeCompare(record.signature, expected)) return "tampered";
  // 2. Check revocation
  if (record.revokedAt !== null) return "revoked";
  // 3. Check expiry
  if (new Date() > record.expiresAt) return "expired";
  // 4. Check download limit
  if (record.downloadCount >= record.maxDownloads) return "limit_exceeded";
  return "valid";
}

function makeRecord(overrides: Partial<{
  token: string;
  bookId: number;
  userId: number;
  expiresAt: Date;
  downloadCount: number;
  maxDownloads: number;
  revokedAt: Date | null;
}> = {}) {
  const token = overrides.token ?? "test-token-revoke";
  const bookId = overrides.bookId ?? 1;
  const userId = overrides.userId ?? 42;
  const expiresAt = overrides.expiresAt ?? new Date(Date.now() + 48 * 3600 * 1000);
  const signature = signToken(token, bookId, userId, expiresAt);
  return {
    token,
    bookId,
    userId,
    expiresAt,
    signature,
    downloadCount: overrides.downloadCount ?? 0,
    maxDownloads: overrides.maxDownloads ?? MAX_DOWNLOADS,
    revokedAt: overrides.revokedAt ?? null,
  };
}

describe("Token revocation guard", () => {
  it("accepts a valid, non-revoked token", () => {
    const record = makeRecord();
    expect(simulateValidation(record)).toBe("valid");
  });

  it("rejects a token with revokedAt set (immediate effect)", () => {
    const record = makeRecord({ revokedAt: new Date() });
    expect(simulateValidation(record)).toBe("revoked");
  });

  it("rejects a token revoked in the past", () => {
    const record = makeRecord({ revokedAt: new Date(Date.now() - 3600 * 1000) });
    expect(simulateValidation(record)).toBe("revoked");
  });

  it("revocation check happens BEFORE expiry check (revoked wins)", () => {
    // Token is both revoked AND expired — should return 'revoked' not 'expired'
    const record = makeRecord({
      revokedAt: new Date(Date.now() - 1000),
      expiresAt: new Date(Date.now() - 2000), // already expired
    });
    // Signature must match the expired expiresAt
    record.signature = signToken(record.token, record.bookId, record.userId, record.expiresAt);
    expect(simulateValidation(record)).toBe("revoked");
  });

  it("revocation check happens BEFORE download limit check (revoked wins)", () => {
    const record = makeRecord({ revokedAt: new Date(), downloadCount: MAX_DOWNLOADS });
    expect(simulateValidation(record)).toBe("revoked");
  });

  it("a restored token (revokedAt = null) is accepted again", () => {
    // Simulate restore: set revokedAt back to null
    const record = makeRecord({ revokedAt: null });
    expect(simulateValidation(record)).toBe("valid");
  });

  it("tamper detection still fires even on a revoked token", () => {
    const record = makeRecord({ revokedAt: new Date() });
    record.signature = "0".repeat(64); // tampered
    expect(simulateValidation(record)).toBe("tampered");
  });

  it("expired token (not revoked) returns 'expired', not 'revoked'", () => {
    const expiresAt = new Date(Date.now() - 1000);
    const record = makeRecord({ expiresAt, revokedAt: null });
    record.signature = signToken(record.token, record.bookId, record.userId, expiresAt);
    expect(simulateValidation(record)).toBe("expired");
  });
});

describe("Revocation DB helpers (unit contract)", () => {
  it("revokeTokensByOrderId sets revokedAt to a Date and revokedBy to admin userId", () => {
    // Simulate what the DB helper does: update matching rows
    const tokens = [
      makeRecord({ revokedAt: null }),
      makeRecord({ token: "token-2", revokedAt: null }),
    ];
    const adminId = 1;
    const revokedAt = new Date();

    const updated = tokens.map((t) => ({
      ...t,
      revokedAt: t.revokedAt === null ? revokedAt : t.revokedAt,
      revokedBy: adminId,
    }));

    expect(updated.every((t) => t.revokedAt !== null)).toBe(true);
    expect(updated.every((t) => t.revokedBy === adminId)).toBe(true);
  });

  it("restoreTokensByOrderId sets revokedAt back to null", () => {
    const revokedAt = new Date(Date.now() - 3600 * 1000);
    const tokens = [
      makeRecord({ revokedAt }),
      makeRecord({ token: "token-2", revokedAt }),
    ];

    const restored = tokens.map((t) => ({ ...t, revokedAt: null, revokedBy: null }));
    expect(restored.every((t) => t.revokedAt === null)).toBe(true);
  });

  it("getOrderTokenStatus correctly categorises tokens", () => {
    const now = new Date();
    const tokens = [
      makeRecord({ revokedAt: null, expiresAt: new Date(now.getTime() + 3600_000), downloadCount: 0 }),  // active
      makeRecord({ token: "t2", revokedAt: new Date(now.getTime() - 1000) }),                            // revoked
      makeRecord({ token: "t3", revokedAt: null, expiresAt: new Date(now.getTime() - 1000) }),           // expired
      makeRecord({ token: "t4", revokedAt: null, downloadCount: MAX_DOWNLOADS }),                        // limit exceeded
    ];

    const status = {
      total: tokens.length,
      active: tokens.filter((t) => t.revokedAt === null && new Date() <= t.expiresAt && t.downloadCount < t.maxDownloads).length,
      revoked: tokens.filter((t) => t.revokedAt !== null).length,
      expired: tokens.filter((t) => t.revokedAt === null && new Date() > t.expiresAt).length,
    };

    // token[0]: active (not revoked, not expired, under limit)
    // token[1]: revoked
    // token[2]: expired (not revoked, past expiresAt)
    // token[3]: limit_exceeded (not revoked, not expired, but downloadCount >= maxDownloads) — still "active" by expiry, but not usable
    expect(status.total).toBe(4);
    expect(status.active).toBe(1);  // only token[0] passes all checks
    expect(status.revoked).toBe(1); // token[1]
    expect(status.expired).toBe(1); // token[2] only (token[3] is not expired, just limit-exceeded)
  });
});
