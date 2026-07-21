import { and, desc, eq, gte, ilike, inArray, like, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  Book,
  InsertBook,
  InsertUser,
  books,
  cartItems,
  chatbotKnowledge,
  cryptoTransactions,
  downloadTokens,
  orderItems,
  orders,
  reviews,
  users,
  wishlists,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── Books ────────────────────────────────────────────────────────────────────
export async function getBooks(opts: {
  search?: string;
  genre?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sort?: string;
  page?: number;
  limit?: number;
  featured?: boolean;
  bestseller?: boolean;
}) {
  const db = await getDb();
  if (!db) return { books: [], total: 0 };
  const { search, genre, minPrice, maxPrice, minRating, sort, page = 1, limit = 12, featured, bestseller } = opts;
  const conditions = [];
  if (search) conditions.push(or(like(books.title, `%${search}%`), like(books.author, `%${search}%`)));
  if (genre) conditions.push(eq(books.genre, genre));
  if (minPrice !== undefined) conditions.push(gte(books.price, String(minPrice)));
  if (maxPrice !== undefined) conditions.push(lte(books.price, String(maxPrice)));
  if (minRating !== undefined) conditions.push(gte(books.rating, String(minRating)));
  if (featured !== undefined) conditions.push(eq(books.featured, featured));
  if (bestseller !== undefined) conditions.push(eq(books.bestseller, bestseller));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  let orderBy;
  switch (sort) {
    case "price_asc": orderBy = books.price; break;
    case "price_desc": orderBy = desc(books.price); break;
    case "rating": orderBy = desc(books.rating); break;
    case "newest": orderBy = desc(books.createdAt); break;
    default: orderBy = desc(books.featured);
  }
  const offset = (page - 1) * limit;
  const [rows, countResult] = await Promise.all([
    db.select().from(books).where(where).orderBy(orderBy).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(books).where(where),
  ]);
  return { books: rows, total: Number(countResult[0]?.count ?? 0) };
}

export async function getBookById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(books).where(eq(books.id, id)).limit(1);
  return result[0];
}

export async function getFeaturedBooks() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(books).where(eq(books.featured, true)).limit(6);
}

export async function getBestsellerBooks() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(books).where(eq(books.bestseller, true)).limit(8);
}

export async function getBooksByGenre(genre: string, limit = 8) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(books).where(eq(books.genre, genre)).limit(limit);
}

export async function createBook(data: InsertBook) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(books).values(data);
  return result;
}

export async function updateBook(id: number, data: Partial<InsertBook>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(books).set(data).where(eq(books.id, id));
}

export async function deleteBook(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(books).where(eq(books.id, id));
}

// ─── Reviews ──────────────────────────────────────────────────────────────────
export async function getReviewsByBookId(bookId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviews).where(eq(reviews.bookId, bookId)).orderBy(desc(reviews.createdAt)).limit(20);
}

export async function addReview(data: { bookId: number; userId: number; userName: string; rating: number; title: string; body: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(reviews).values({ ...data, verified: true });
  // Update book rating
  const allReviews = await db.select().from(reviews).where(eq(reviews.bookId, data.bookId));
  const avg = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
  await db.update(books).set({ rating: avg.toFixed(2), reviewCount: allReviews.length }).where(eq(books.id, data.bookId));
}

// ─── Cart ─────────────────────────────────────────────────────────────────────
export async function getCartItems(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const items = await db.select().from(cartItems).where(eq(cartItems.userId, userId));
  if (items.length === 0) return [];
  const bookIds = items.map((i) => i.bookId);
  const bookList = await db.select().from(books).where(inArray(books.id, bookIds));
  return items.map((item) => ({ ...item, book: bookList.find((b) => b.id === item.bookId) }));
}

export async function addToCart(userId: number, bookId: number, quantity = 1) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existing = await db.select().from(cartItems).where(and(eq(cartItems.userId, userId), eq(cartItems.bookId, bookId))).limit(1);
  if (existing[0]) {
    await db.update(cartItems).set({ quantity: existing[0].quantity + quantity }).where(eq(cartItems.id, existing[0].id));
  } else {
    await db.insert(cartItems).values({ userId, bookId, quantity });
  }
}

export async function updateCartItem(id: number, userId: number, quantity: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  if (quantity <= 0) {
    await db.delete(cartItems).where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)));
  } else {
    await db.update(cartItems).set({ quantity }).where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)));
  }
}

export async function removeFromCart(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(cartItems).where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)));
}

export async function clearCart(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(cartItems).where(eq(cartItems.userId, userId));
}

// ─── Wishlist ─────────────────────────────────────────────────────────────────
export async function getWishlist(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const items = await db.select().from(wishlists).where(eq(wishlists.userId, userId));
  if (items.length === 0) return [];
  const bookIds = items.map((i) => i.bookId);
  const bookList = await db.select().from(books).where(inArray(books.id, bookIds));
  return items.map((item) => ({ ...item, book: bookList.find((b) => b.id === item.bookId) }));
}

export async function toggleWishlist(userId: number, bookId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existing = await db.select().from(wishlists).where(and(eq(wishlists.userId, userId), eq(wishlists.bookId, bookId))).limit(1);
  if (existing[0]) {
    await db.delete(wishlists).where(eq(wishlists.id, existing[0].id));
    return false;
  } else {
    await db.insert(wishlists).values({ userId, bookId });
    return true;
  }
}

export async function getWishlistBookIds(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const items = await db.select({ bookId: wishlists.bookId }).from(wishlists).where(eq(wishlists.userId, userId));
  return items.map((i) => i.bookId);
}

// ─── Orders ───────────────────────────────────────────────────────────────────
export async function createOrder(data: {
  userId: number;
  totalAmount: number;
  cryptoCurrency: string;
  shippingAddress: string;
  items: Array<{ bookId: number; quantity: number; price: number; bookTitle: string; bookAuthor: string; bookCover?: string }>;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(orders).values({
    userId: data.userId,
    totalAmount: String(data.totalAmount),
    cryptoCurrency: data.cryptoCurrency,
    status: "pending",
    paymentStatus: "pending",
    shippingAddress: data.shippingAddress,
  });
  const orderId = (result as any).insertId;
  for (const item of data.items) {
    await db.insert(orderItems).values({ orderId, ...item, price: String(item.price) });
  }
  return orderId;
}

export async function getOrdersByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const orderList = await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
  const result = [];
  for (const order of orderList) {
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    result.push({ ...order, items });
  }
  return result;
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const orderList = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!orderList[0]) return undefined;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  return { ...orderList[0], items };
}

export async function updateOrderPayment(orderId: number, data: { txHash: string; cryptoAmount: string; walletAddress: string; paymentStatus: "confirming" | "confirmed" | "failed"; status?: "paid" }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(orders).set({ ...data }).where(eq(orders.id, orderId));
}

export async function getAllOrders(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit);
}

export async function updateOrderStatus(orderId: number, status: "pending" | "paid" | "processing" | "shipped" | "delivered" | "cancelled") {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(orders).set({ status }).where(eq(orders.id, orderId));
}

// ─── Crypto Transactions ──────────────────────────────────────────────────────
export async function createCryptoTransaction(data: {
  orderId: number;
  currency: string;
  amount: string;
  usdAmount: string;
  txHash: string;
  fromAddress?: string;
  toAddress: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(cryptoTransactions).values({ ...data, status: "pending" });
  return (result as any).insertId;
}

export async function updateCryptoTransaction(id: number, data: Partial<{ status: "pending" | "confirming" | "confirmed" | "failed"; confirmations: number; blockNumber: number; confirmedAt: Date }>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(cryptoTransactions).set(data).where(eq(cryptoTransactions.id, id));
}

export async function getCryptoTransactionByOrderId(orderId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(cryptoTransactions).where(eq(cryptoTransactions.orderId, orderId)).limit(1);
  return result[0];
}

// ─── Chatbot Knowledge ────────────────────────────────────────────────────────
export async function getActiveKnowledge() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatbotKnowledge).where(eq(chatbotKnowledge.active, true)).orderBy(desc(chatbotKnowledge.priority));
}

export async function getAllKnowledge() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatbotKnowledge).orderBy(desc(chatbotKnowledge.createdAt));
}

export async function upsertKnowledge(data: { id?: number; category: string; question: string; answer: string; keywords?: string; active?: boolean; priority?: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  if (data.id) {
    await db.update(chatbotKnowledge).set({ category: data.category, question: data.question, answer: data.answer, keywords: data.keywords, active: data.active ?? true, priority: data.priority ?? 0 }).where(eq(chatbotKnowledge.id, data.id));
    return data.id;
  } else {
    const [result] = await db.insert(chatbotKnowledge).values({ category: data.category, question: data.question, answer: data.answer, keywords: data.keywords, active: data.active ?? true, priority: data.priority ?? 0 });
    return (result as any).insertId;
  }
}

export async function deleteKnowledge(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(chatbotKnowledge).where(eq(chatbotKnowledge.id, id));
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export async function getAdminStats() {
  const db = await getDb();
  if (!db) return { totalBooks: 0, totalOrders: 0, totalRevenue: 0, totalUsers: 0 };
  const [bookCount, orderCount, revenueResult, userCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(books),
    db.select({ count: sql<number>`count(*)` }).from(orders),
    db.select({ total: sql<number>`sum(totalAmount)` }).from(orders).where(eq(orders.paymentStatus, "confirmed")),
    db.select({ count: sql<number>`count(*)` }).from(users),
  ]);
  return {
    totalBooks: Number(bookCount[0]?.count ?? 0),
    totalOrders: Number(orderCount[0]?.count ?? 0),
    totalRevenue: Number(revenueResult[0]?.total ?? 0),
    totalUsers: Number(userCount[0]?.count ?? 0),
  };
}

export async function getTopBooks(limit = 5) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(books).orderBy(desc(books.reviewCount)).limit(limit);
}

export async function getRecentOrders(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit);
}

// ─── Book File Delivery ───────────────────────────────────────────────────────

/** Persist S3 file metadata + real SHA-256 hash onto a book record. */
export async function updateBookFile(
  bookId: number,
  data: {
    fileKey: string;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    fileMimeType: string;
    fileHash: string; // real SHA-256 hex of file bytes
  },
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(books)
    .set({
      fileKey: data.fileKey,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      fileSize: data.fileSize,
      fileMimeType: data.fileMimeType,
      fileHash: data.fileHash,
      // Also update the canonical contentHash to reflect the real file hash
      contentHash: data.fileHash,
      hashAlgorithm: "SHA-256",
      signatureTimestamp: new Date(),
    })
    .where(eq(books.id, bookId));
}

/** Clear file delivery fields from a book (e.g. when admin removes the file). */
export async function clearBookFile(bookId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(books)
    .set({
      fileKey: null,
      fileUrl: null,
      fileName: null,
      fileSize: null,
      fileMimeType: null,
      fileHash: null,
    })
    .where(eq(books.id, bookId));
}

/**
 * Returns true if the given user has at least one paid/delivered order
 * that contains the specified book.
 */
export async function hasPurchasedBook(userId: number, bookId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  // Find paid orders for this user
  const paidOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.userId, userId),
        // Allow download once payment is confirmed or order is delivered
        sql`${orders.paymentStatus} IN ('confirmed') OR ${orders.status} IN ('paid','processing','shipped','delivered')`,
      ),
    );
  if (paidOrders.length === 0) return false;
  const orderIds = paidOrders.map((o) => o.id);
  const match = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(and(inArray(orderItems.orderId, orderIds), eq(orderItems.bookId, bookId)))
    .limit(1);
  return match.length > 0;
}

// ─── Download Token Revocation ────────────────────────────────────────────────

/**
 * Revoke all active (non-expired, non-already-revoked) download tokens for a
 * given order. Called by admins after issuing a refund or detecting abuse.
 *
 * Returns the number of tokens that were actually updated.
 */
export async function revokeTokensByOrderId(
  orderId: number,
  adminUserId: number,
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  // Fetch all tokens for this order that are not yet revoked
  const activeTokens = await db
    .select({ id: downloadTokens.id })
    .from(downloadTokens)
    .where(
      and(
        eq(downloadTokens.orderId, orderId),
        sql`${downloadTokens.revokedAt} IS NULL`,
      ),
    );

  if (activeTokens.length === 0) return 0;

  const now = new Date();
  await db
    .update(downloadTokens)
    .set({ revokedAt: now, revokedBy: adminUserId })
    .where(
      and(
        eq(downloadTokens.orderId, orderId),
        sql`${downloadTokens.revokedAt} IS NULL`,
      ),
    );

  return activeTokens.length;
}

/**
 * Restore previously revoked tokens for an order (clears revokedAt + revokedBy).
 * Useful for edge cases like a refund reversal.
 *
 * Returns the number of tokens that were restored.
 */
export async function restoreTokensByOrderId(orderId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const revokedTokens = await db
    .select({ id: downloadTokens.id })
    .from(downloadTokens)
    .where(
      and(
        eq(downloadTokens.orderId, orderId),
        sql`${downloadTokens.revokedAt} IS NOT NULL`,
      ),
    );

  if (revokedTokens.length === 0) return 0;

  await db
    .update(downloadTokens)
    .set({ revokedAt: null, revokedBy: null })
    .where(
      and(
        eq(downloadTokens.orderId, orderId),
        sql`${downloadTokens.revokedAt} IS NOT NULL`,
      ),
    );

  return revokedTokens.length;
}

/**
 * Returns a summary of token status for an order:
 * total, active (not expired, not revoked), expired, revoked.
 * Used by the admin UI to show the current state before revoking.
 */
export async function getOrderTokenStatus(orderId: number): Promise<{
  total: number;
  active: number;
  expired: number;
  revoked: number;
}> {
  const db = await getDb();
  if (!db) return { total: 0, active: 0, expired: 0, revoked: 0 };

  const tokens = await db
    .select({
      expiresAt: downloadTokens.expiresAt,
      revokedAt: downloadTokens.revokedAt,
    })
    .from(downloadTokens)
    .where(eq(downloadTokens.orderId, orderId));

  const now = new Date();
  let active = 0, expired = 0, revoked = 0;

  for (const t of tokens) {
    if (t.revokedAt) {
      revoked++;
    } else if (t.expiresAt < now) {
      expired++;
    } else {
      active++;
    }
  }

  return { total: tokens.length, active, expired, revoked };
}
