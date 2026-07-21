import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createHash } from "crypto";
import { storagePut, storageGetSignedUrl } from "./storage";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import { nanoid } from "nanoid";
import {
  generateDownloadToken,
  sendBookDeliveryEmail,
  validateDownloadToken,
  recordTokenUsage,
} from "./emailDelivery";

// ─── Admin guard ──────────────────────────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  return next({ ctx });
});

// ─── Crypto payment simulation helpers ───────────────────────────────────────
const CRYPTO_RATES: Record<string, number> = { ETH: 3250, BTC: 67000, LTC: 85, USDT: 1 };
const STORE_WALLETS: Record<string, string> = {
  ETH: "0x742d35Cc6634C0532925a3b8D4C9C2B5e2e1A8f3",
  BTC: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  LTC: "ltc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  // BEP-20 USDT on Binance Smart Chain
  USDT: "0x3A5e8f9B2C1d4E7f6A8b0C2D4E6F8a0B2C4D6E8F",
};

// BSC network metadata for USDT
const CRYPTO_NETWORK: Record<string, { name: string; chainId: number; explorerUrl: string; token?: string }> = {
  ETH: { name: "Ethereum Mainnet", chainId: 1, explorerUrl: "https://etherscan.io/tx" },
  BTC: { name: "Bitcoin Network", chainId: 0, explorerUrl: "https://blockstream.info/tx" },
  LTC: { name: "Litecoin Network", chainId: 0, explorerUrl: "https://blockchair.com/litecoin/transaction" },
  USDT: { name: "BNB Smart Chain (BSC)", chainId: 56, explorerUrl: "https://bscscan.com/tx", token: "USDT BEP-20" },
};

function generateTxHash(currency: string): string {
  const chars = "0123456789abcdef";
  if (currency === "BTC") {
    // Bitcoin: 64-char hex, no 0x prefix
    return Array.from({ length: 64 }, () => chars[Math.floor(Math.random() * 16)]).join("");
  }
  // ETH / LTC / USDT (BSC): 0x + 64-char hex (EVM-style)
  return "0x" + Array.from({ length: 64 }, () => chars[Math.floor(Math.random() * 16)]).join("");
}

function generateWalletAddress(currency: string): string {
  if (currency === "ETH" || currency === "USDT") {
    // EVM-compatible address (ETH and BSC share the same format)
    return "0x" + Array.from({ length: 40 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
  }
  if (currency === "BTC") return "bc1q" + Array.from({ length: 39 }, () => "0123456789abcdefghjklmnpqrstuvwxyz"[Math.floor(Math.random() * 34)]).join("");
  return "ltc1q" + Array.from({ length: 39 }, () => "0123456789abcdefghjklmnpqrstuvwxyz"[Math.floor(Math.random() * 34)]).join("");
}

export const appRouter = router({
  system: systemRouter,

  // ─── Auth ──────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Books ─────────────────────────────────────────────────────────────────
  books: router({
    list: publicProcedure
      .input(z.object({
        search: z.string().optional(),
        genre: z.string().optional(),
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        minRating: z.number().optional(),
        sort: z.string().optional(),
        page: z.number().default(1),
        limit: z.number().default(12),
      }))
      .query(({ input }) => db.getBooks(input)),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const book = await db.getBookById(input.id);
        if (!book) throw new TRPCError({ code: "NOT_FOUND" });
        return book;
      }),

    featured: publicProcedure.query(() => db.getFeaturedBooks()),
    bestsellers: publicProcedure.query(() => db.getBestsellerBooks()),

    byGenre: publicProcedure
      .input(z.object({ genre: z.string(), limit: z.number().default(8) }))
      .query(({ input }) => db.getBooksByGenre(input.genre, input.limit)),

    genres: publicProcedure.query(async () => {
      return ["Technology", "Business", "Science", "Fiction", "Thriller"];
    }),

    // Admin CRUD
    create: adminProcedure
      .input(z.object({
        title: z.string(),
        author: z.string(),
        authorBio: z.string().optional(),
        description: z.string().optional(),
        genre: z.string(),
        price: z.string(),
        originalPrice: z.string().optional(),
        coverUrl: z.string().optional(),
        isbn: z.string().optional(),
        pages: z.number().optional(),
        publishedYear: z.number().optional(),
        featured: z.boolean().default(false),
        bestseller: z.boolean().default(false),
        stock: z.number().default(100),
      }))
      .mutation(async ({ input }) => {
        // Generate RSA key and hash for new books
        const contentHash = Array.from({ length: 64 }, (_, i) => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
        const rsaPublicKey = `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA${nanoid(40)}\n-----END PUBLIC KEY-----`;
        await db.createBook({ ...input, contentHash, rsaPublicKey, hashAlgorithm: "SHA-256", signatureTimestamp: new Date() });
        return { success: true };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        author: z.string().optional(),
        authorBio: z.string().optional(),
        description: z.string().optional(),
        genre: z.string().optional(),
        price: z.string().optional(),
        originalPrice: z.string().optional(),
        coverUrl: z.string().optional(),
        featured: z.boolean().optional(),
        bestseller: z.boolean().optional(),
        stock: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateBook(id, data);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteBook(input.id);
        return { success: true };
      }),

    /**
     * Admin: upload a PDF/ePub file for a book.
     * Receives base64-encoded file bytes, computes real SHA-256 hash,
     * uploads to S3, and persists metadata + hash on the book record.
     */
    uploadFile: adminProcedure
      .input(z.object({
        bookId: z.number(),
        fileName: z.string(),
        mimeType: z.enum(["application/pdf", "application/epub+zip", "application/octet-stream"]),
        base64Data: z.string(), // base64-encoded file bytes
      }))
      .mutation(async ({ input }) => {
        const { bookId, fileName, mimeType, base64Data } = input;
        // Verify book exists
        const book = await db.getBookById(bookId);
        if (!book) throw new TRPCError({ code: "NOT_FOUND", message: "Book not found" });
        // Decode base64 → Buffer
        const fileBuffer = Buffer.from(base64Data, "base64");
        // Compute real SHA-256 hash of the file bytes
        const fileHash = createHash("sha256").update(fileBuffer).digest("hex");
        // Upload to S3
        const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storageKey = `books/${bookId}/${safeFileName}`;
        const { key, url } = await storagePut(storageKey, fileBuffer, mimeType);
        // Persist file metadata + real hash on the book
        await db.updateBookFile(bookId, {
          fileKey: key,
          fileUrl: url,
          fileName: fileName,
          fileSize: fileBuffer.length,
          fileMimeType: mimeType,
          fileHash,
        });
        return { success: true, fileHash, fileSize: fileBuffer.length, fileUrl: url };
      }),

    /** Admin: remove the uploaded file from a book (clears file fields). */
    removeFile: adminProcedure
      .input(z.object({ bookId: z.number() }))
      .mutation(async ({ input }) => {
        await db.clearBookFile(input.bookId);
        return { success: true };
      }),

    /**
     * Customer: get a secure, time-limited download URL for a purchased book.
     * Verifies the user has a paid order containing this book before returning the URL.
     */
    download: protectedProcedure
      .input(z.object({ bookId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const book = await db.getBookById(input.bookId);
        if (!book) throw new TRPCError({ code: "NOT_FOUND", message: "Book not found" });
        if (!book.fileKey) throw new TRPCError({ code: "NOT_FOUND", message: "No file available for this book" });
        // Admins can always download; regular users must have purchased the book
        if (ctx.user.role !== "admin") {
          const purchased = await db.hasPurchasedBook(ctx.user.id, input.bookId);
          if (!purchased) throw new TRPCError({ code: "FORBIDDEN", message: "Purchase this book to download it" });
        }
        // Return a signed download URL (valid for 1 hour)
        const signedUrl = await storageGetSignedUrl(book.fileKey);
        return {
          url: signedUrl,
          fileName: book.fileName || `${book.title}.pdf`,
          fileHash: book.fileHash,
          fileSize: book.fileSize,
        };
      }),

    /**
     * Public: get a short-TTL presigned URL for the first N pages of a book's PDF.
     * No purchase required — this is the free sample preview.
     * The URL expires in 15 minutes and is served directly from S3.
     */
    previewUrl: publicProcedure
      .input(z.object({ bookId: z.number() }))
      .query(async ({ input }) => {
        const book = await db.getBookById(input.bookId);
        if (!book) throw new TRPCError({ code: "NOT_FOUND", message: "Book not found" });
        if (!book.fileKey) throw new TRPCError({ code: "NOT_FOUND", message: "No preview available for this book" });
        // Return a short-TTL presigned URL (15 minutes = 900 seconds)
        // The page limit (first 10 pages) is enforced client-side by react-pdf
        const previewUrl = await storageGetSignedUrl(book.fileKey, 900);
        return {
          previewUrl,
          fileName: book.fileName || `${book.title}.pdf`,
          totalPages: null as number | null, // actual page count discovered by react-pdf
          previewPageLimit: 10,
        };
      }),

    /** Check if the current user has purchased a specific book (for UI gating). */
    checkPurchased: protectedProcedure
      .input(z.object({ bookId: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role === "admin") return { purchased: true };
        const purchased = await db.hasPurchasedBook(ctx.user.id, input.bookId);
        return { purchased };
      }),

    /**
     * Re-send the delivery email for a specific order.
     * Generates fresh tokens for all downloadable books in the order.
     * Rate-limited: only one resend per order per 10 minutes.
     */
    resendDeliveryEmail: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        if (order.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        if (order.paymentStatus !== "confirmed") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Order payment not confirmed yet" });
        }

        const buyer = await db.getUserByOpenId(ctx.user.openId);
        if (!buyer?.email) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No email address on your account" });
        }

        const emailItems: Array<{
          bookId: number;
          bookTitle: string;
          bookAuthor: string;
          bookCover?: string | null;
          downloadUrl: string;
          expiresAt: Date;
          hasFile: boolean;
        }> = [];

        for (const item of order.items) {
          const bookData = await db.getBookById(item.bookId);
          const hasFile = !!(bookData?.fileKey);
          let downloadUrl = "";
          let expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

          if (hasFile) {
            const tokenResult = await generateDownloadToken(
              item.bookId,
              input.orderId,
              ctx.user.id
            );
            downloadUrl = tokenResult.downloadUrl;
            expiresAt = tokenResult.expiresAt;
          }

          emailItems.push({
            bookId: item.bookId,
            bookTitle: item.bookTitle || "Unknown Title",
            bookAuthor: item.bookAuthor || "Unknown Author",
            bookCover: item.bookCover,
            downloadUrl,
            expiresAt,
            hasFile,
          });
        }

        const sent = await sendBookDeliveryEmail({
          buyerEmail: buyer.email,
          buyerName: buyer.name || "Valued Customer",
          orderId: input.orderId,
          txHash: order.txHash || "",
          items: emailItems,
        });

        return { success: sent, sentTo: buyer.email };
      }),

    /**
     * Admin: Get the current token status for an order (total, active, expired, revoked).
     * Used to populate the confirmation dialog before revoking.
     */
    getOrderTokenStatus: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .query(({ input }) => db.getOrderTokenStatus(input.orderId)),

    /**
     * Admin: Revoke all active download tokens for an order.
     * Typically called after issuing a refund or detecting abuse.
     * Returns the number of tokens that were revoked.
     */
    revokeOrderTokens: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        const revokedCount = await db.revokeTokensByOrderId(input.orderId, ctx.user.id);
        return { success: true, revokedCount, orderId: input.orderId };
      }),

    /**
     * Admin: Restore previously revoked tokens for an order.
     * Useful for edge cases like a refund reversal or accidental revocation.
     * Returns the number of tokens that were restored.
     */
    restoreOrderTokens: adminProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        const restoredCount = await db.restoreTokensByOrderId(input.orderId);
        return { success: true, restoredCount, orderId: input.orderId };
      }),
  }),

  // ─── Reviews ───────────────────────────────────────────────────────────────
  reviews: router({
    getByBook: publicProcedure
      .input(z.object({ bookId: z.number() }))
      .query(({ input }) => db.getReviewsByBookId(input.bookId)),

    add: protectedProcedure
      .input(z.object({
        bookId: z.number(),
        rating: z.number().min(1).max(5),
        title: z.string(),
        body: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.addReview({ ...input, userId: ctx.user.id, userName: ctx.user.name || "Anonymous" });
        return { success: true };
      }),
  }),

  // ─── Cart ──────────────────────────────────────────────────────────────────
  cart: router({
    get: protectedProcedure.query(({ ctx }) => db.getCartItems(ctx.user.id)),

    add: protectedProcedure
      .input(z.object({ bookId: z.number(), quantity: z.number().default(1) }))
      .mutation(async ({ input, ctx }) => {
        await db.addToCart(ctx.user.id, input.bookId, input.quantity);
        return { success: true };
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number(), quantity: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.updateCartItem(input.id, ctx.user.id, input.quantity);
        return { success: true };
      }),

    remove: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.removeFromCart(input.id, ctx.user.id);
        return { success: true };
      }),

    clear: protectedProcedure.mutation(({ ctx }) => db.clearCart(ctx.user.id)),
  }),

  // ─── Wishlist ──────────────────────────────────────────────────────────────
  wishlist: router({
    get: protectedProcedure.query(({ ctx }) => db.getWishlist(ctx.user.id)),
    getIds: protectedProcedure.query(({ ctx }) => db.getWishlistBookIds(ctx.user.id)),
    toggle: protectedProcedure
      .input(z.object({ bookId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const added = await db.toggleWishlist(ctx.user.id, input.bookId);
        return { added };
      }),
  }),

  // ─── Orders ────────────────────────────────────────────────────────────────
  orders: router({
    create: protectedProcedure
      .input(z.object({
        cryptoCurrency: z.string(),
        shippingAddress: z.string(),
        items: z.array(z.object({
          bookId: z.number(),
          quantity: z.number(),
          price: z.number(),
          bookTitle: z.string(),
          bookAuthor: z.string(),
          bookCover: z.string().optional(),
        })),
        totalAmount: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const orderId = await db.createOrder({ ...input, userId: ctx.user.id });
        return { orderId };
      }),

    myOrders: protectedProcedure.query(({ ctx }) => db.getOrdersByUserId(ctx.user.id)),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const order = await db.getOrderById(input.id);
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        if (order.userId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        return order;
      }),

    // Admin
    all: adminProcedure.query(() => db.getAllOrders()),
    updateStatus: adminProcedure
      .input(z.object({ id: z.number(), status: z.enum(["pending", "paid", "processing", "shipped", "delivered", "cancelled"]) }))
      .mutation(async ({ input }) => {
        await db.updateOrderStatus(input.id, input.status);
        return { success: true };
      }),
  }),

  // ─── Crypto Payment ────────────────────────────────────────────────────────
  payment: router({
    initiate: protectedProcedure
      .input(z.object({
        orderId: z.number(),
        currency: z.enum(["ETH", "BTC", "LTC", "USDT"]),
        usdAmount: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        if (order.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

        const rate = CRYPTO_RATES[input.currency];
        const cryptoAmount = (input.usdAmount / rate).toFixed(8);
        const txHash = generateTxHash(input.currency);
        const fromAddress = generateWalletAddress(input.currency);
        const toAddress = STORE_WALLETS[input.currency];

        // Create transaction record
        const txId = await db.createCryptoTransaction({
          orderId: input.orderId,
          currency: input.currency,
          amount: cryptoAmount,
          usdAmount: String(input.usdAmount),
          txHash,
          fromAddress,
          toAddress,
        });

        // Update order with payment info
        await db.updateOrderPayment(input.orderId, {
          txHash,
          cryptoAmount,
          walletAddress: toAddress,
          paymentStatus: "confirming",
        });

        const networkInfo = CRYPTO_NETWORK[input.currency];
        const explorerLink = networkInfo
          ? `${networkInfo.explorerUrl}/${txHash}`
          : null;

        return {
          txHash,
          txId,
          fromAddress,
          toAddress,
          cryptoAmount,
          currency: input.currency,
          usdAmount: input.usdAmount,
          exchangeRate: rate,
          estimatedConfirmTime:
            input.currency === "BTC" ? "10-30 minutes" :
            input.currency === "USDT" ? "3-5 seconds" : "15-30 seconds",
          networkFee:
            input.currency === "ETH" ? "0.00021" :
            input.currency === "BTC" ? "0.00005" :
            input.currency === "USDT" ? "0.50" : "0.001",
          networkFeeCurrency:
            input.currency === "USDT" ? "USDT" :
            input.currency === "BTC" ? "BTC" :
            input.currency === "LTC" ? "LTC" : "ETH",
          network: networkInfo?.name ?? "Unknown Network",
          chainId: networkInfo?.chainId ?? null,
          token: networkInfo?.token ?? null,
          explorerLink,
        };
      }),

    checkStatus: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input, ctx }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        if (order.userId !== ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const tx = await db.getCryptoTransactionByOrderId(input.orderId);
        return { order, transaction: tx };
      }),

    // Simulate confirmation (called after delay)
    confirm: protectedProcedure
      .input(z.object({ orderId: z.number(), txId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        if (order.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

        const blockNumber = Math.floor(Math.random() * 1000000) + 19000000;
        await db.updateCryptoTransaction(input.txId, {
          status: "confirmed",
          confirmations: 12,
          blockNumber,
          confirmedAt: new Date(),
        });
        await db.updateOrderPayment(input.orderId, {
          txHash: order.txHash || "",
          cryptoAmount: order.cryptoAmount || "0",
          walletAddress: order.walletAddress || "",
          paymentStatus: "confirmed",
          status: "paid",
        });
        await db.clearCart(ctx.user.id);

        // ── Email delivery: generate signed tokens and send email ──────────
        let emailSent = false;
        try {
          const fullOrder = await db.getOrderById(input.orderId);
          const buyer = await db.getUserByOpenId(ctx.user.openId);
          if (fullOrder && buyer?.email) {
            const emailItems: Array<{
              bookId: number;
              bookTitle: string;
              bookAuthor: string;
              bookCover?: string | null;
              downloadUrl: string;
              expiresAt: Date;
              hasFile: boolean;
            }> = [];

            for (const item of fullOrder.items) {
              // Fetch book to check if it has an uploaded file
              const bookData = await db.getBookById(item.bookId);
              const hasFile = !!(bookData?.fileKey);
              let downloadUrl = "";
              let expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

              if (hasFile) {
                const tokenResult = await generateDownloadToken(
                  item.bookId,
                  input.orderId,
                  ctx.user.id
                );
                downloadUrl = tokenResult.downloadUrl;
                expiresAt = tokenResult.expiresAt;
              }

              emailItems.push({
                bookId: item.bookId,
                bookTitle: item.bookTitle || "Unknown Title",
                bookAuthor: item.bookAuthor || "Unknown Author",
                bookCover: item.bookCover,
                downloadUrl,
                expiresAt,
                hasFile,
              });
            }

            emailSent = await sendBookDeliveryEmail({
              buyerEmail: buyer.email,
              buyerName: buyer.name || "Valued Customer",
              orderId: input.orderId,
              txHash: order.txHash || "",
              items: emailItems,
            });
          }
        } catch (emailErr) {
          // Email failure must never block the payment confirmation response
          console.error("[payment.confirm] Email delivery error:", emailErr);
        }

        return { success: true, blockNumber, emailSent };
      }),

    getRates: publicProcedure.query(() => CRYPTO_RATES),
  }),

  // ─── Chatbot ───────────────────────────────────────────────────────────────
  chatbot: router({
    chat: publicProcedure
      .input(z.object({
        message: z.string(),
        history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).default([]),
      }))
      .mutation(async ({ input }) => {
        const knowledge = await db.getActiveKnowledge();
        const knowledgeContext = knowledge.map((k) => `Q: ${k.question}\nA: ${k.answer}`).join("\n\n");

        const systemPrompt = `You are BookBot, a friendly and knowledgeable AI assistant for CryptoBook Store — a premium online bookstore specializing in technology, business, science, fiction, and thriller books.

You help customers with:
- Finding books by genre, author, or topic
- Understanding our cryptocurrency payment system (ETH, BTC, LTC)
- Explaining our cryptographic book integrity verification (RSA + SHA-256)
- Order tracking and account questions
- General book recommendations

KNOWLEDGE BASE (use this to answer questions accurately):
${knowledgeContext}

Keep responses concise, friendly, and helpful. Use markdown formatting for lists and emphasis. If asked about something outside your knowledge base, give a helpful general answer and suggest contacting support.`;

        const messages = [
          { role: "system" as const, content: systemPrompt },
          ...input.history.slice(-10),
          { role: "user" as const, content: input.message },
        ];

        const response = await invokeLLM({ messages });
        const content = response.choices[0]?.message?.content || "I apologize, I couldn't process your request. Please try again.";
        return { content };
      }),

    getKnowledge: adminProcedure.query(() => db.getAllKnowledge()),

    upsertKnowledge: adminProcedure
      .input(z.object({
        id: z.number().optional(),
        category: z.string().default("general"),
        question: z.string(),
        answer: z.string(),
        keywords: z.string().optional(),
        active: z.boolean().default(true),
        priority: z.number().default(0),
      }))
      .mutation(async ({ input }) => {
        const id = await db.upsertKnowledge(input);
        return { id };
      }),

    deleteKnowledge: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteKnowledge(input.id);
        return { success: true };
      }),
  }),

  // ─── Admin ─────────────────────────────────────────────────────────────────
  admin: router({
    stats: adminProcedure.query(() => db.getAdminStats()),
    topBooks: adminProcedure.query(() => db.getTopBooks()),
    recentOrders: adminProcedure.query(() => db.getRecentOrders()),
  }),
});

export type AppRouter = typeof appRouter;
