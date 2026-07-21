import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  json,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Books ────────────────────────────────────────────────────────────────────
export const books = mysqlTable("books", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 512 }).notNull(),
  author: varchar("author", { length: 256 }).notNull(),
  authorBio: text("authorBio"),
  description: text("description"),
  genre: varchar("genre", { length: 64 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  originalPrice: decimal("originalPrice", { precision: 10, scale: 2 }),
  coverUrl: text("coverUrl"),
  isbn: varchar("isbn", { length: 32 }),
  pages: int("pages"),
  publishedYear: int("publishedYear"),
  language: varchar("language", { length: 32 }).default("English"),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0.00"),
  reviewCount: int("reviewCount").default(0),
  stock: int("stock").default(100),
  featured: boolean("featured").default(false),
  bestseller: boolean("bestseller").default(false),
  // Cryptographic integrity fields
  rsaPublicKey: text("rsaPublicKey"),
  contentHash: varchar("contentHash", { length: 128 }),
  hashAlgorithm: varchar("hashAlgorithm", { length: 16 }).default("SHA-256"),
  signatureTimestamp: timestamp("signatureTimestamp"),
  // Book file delivery (S3)
  fileKey: varchar("fileKey", { length: 512 }),
  fileUrl: text("fileUrl"),
  fileName: varchar("fileName", { length: 256 }),
  fileSize: int("fileSize"),
  fileMimeType: varchar("fileMimeType", { length: 64 }),
  fileHash: varchar("fileHash", { length: 128 }),  // real SHA-256 of file bytes
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Book = typeof books.$inferSelect;
export type InsertBook = typeof books.$inferInsert;

// ─── Reviews ──────────────────────────────────────────────────────────────────
export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  bookId: int("bookId").notNull(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 256 }),
  rating: int("rating").notNull(),
  title: varchar("title", { length: 256 }),
  body: text("body"),
  verified: boolean("verified").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;

// ─── Cart Items ───────────────────────────────────────────────────────────────
export const cartItems = mysqlTable("cart_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  bookId: int("bookId").notNull(),
  quantity: int("quantity").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = typeof cartItems.$inferInsert;

// ─── Wishlists ────────────────────────────────────────────────────────────────
export const wishlists = mysqlTable("wishlists", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  bookId: int("bookId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Wishlist = typeof wishlists.$inferSelect;

// ─── Orders ───────────────────────────────────────────────────────────────────
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", ["pending", "paid", "processing", "shipped", "delivered", "cancelled"]).default("pending").notNull(),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  cryptoCurrency: varchar("cryptoCurrency", { length: 16 }),
  cryptoAmount: decimal("cryptoAmount", { precision: 20, scale: 8 }),
  txHash: varchar("txHash", { length: 128 }),
  walletAddress: varchar("walletAddress", { length: 128 }),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "confirming", "confirmed", "failed"]).default("pending"),
  shippingAddress: text("shippingAddress"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

// ─── Order Items ──────────────────────────────────────────────────────────────
export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  bookId: int("bookId").notNull(),
  quantity: int("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  bookTitle: varchar("bookTitle", { length: 512 }),
  bookAuthor: varchar("bookAuthor", { length: 256 }),
  bookCover: text("bookCover"),
});

export type OrderItem = typeof orderItems.$inferSelect;

// ─── Crypto Transactions ──────────────────────────────────────────────────────
export const cryptoTransactions = mysqlTable("crypto_transactions", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  currency: varchar("currency", { length: 16 }).notNull(),
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  usdAmount: decimal("usdAmount", { precision: 10, scale: 2 }).notNull(),
  txHash: varchar("txHash", { length: 128 }).notNull(),
  fromAddress: varchar("fromAddress", { length: 128 }),
  toAddress: varchar("toAddress", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["pending", "confirming", "confirmed", "failed"]).default("pending").notNull(),
  confirmations: int("confirmations").default(0),
  blockNumber: int("blockNumber"),
  gasUsed: varchar("gasUsed", { length: 64 }),
  networkFee: decimal("networkFee", { precision: 20, scale: 8 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  confirmedAt: timestamp("confirmedAt"),
});

export type CryptoTransaction = typeof cryptoTransactions.$inferSelect;

// ─── Chatbot Knowledge Base ───────────────────────────────────────────────────
export const chatbotKnowledge = mysqlTable("chatbot_knowledge", {
  id: int("id").autoincrement().primaryKey(),
  category: varchar("category", { length: 64 }).default("general"),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  keywords: text("keywords"),
  active: boolean("active").default(true),
  priority: int("priority").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChatbotKnowledge = typeof chatbotKnowledge.$inferSelect;
export type InsertChatbotKnowledge = typeof chatbotKnowledge.$inferInsert;

// ─── Download Tokens ────────────────────────────────────────────────────────────────────────────
// Stores HMAC-SHA256 signed, time-limited tokens for secure book download links
// sent via email after payment confirmation.
export const downloadTokens = mysqlTable("download_tokens", {
  id: int("id").autoincrement().primaryKey(),
  // The opaque token string (nanoid) embedded in the download URL
  token: varchar("token", { length: 64 }).notNull().unique(),
  // HMAC-SHA256 signature over (token + bookId + userId + expiresAt)
  signature: varchar("signature", { length: 128 }).notNull(),
  bookId: int("bookId").notNull(),
  orderId: int("orderId").notNull(),
  userId: int("userId").notNull(),
  // 48-hour expiry window from creation
  expiresAt: timestamp("expiresAt").notNull(),
  // Null until the token is redeemed; once used, it cannot be reused
  usedAt: timestamp("usedAt"),
  // Number of times the token has been used (allow multiple downloads, cap at 5)
  downloadCount: int("downloadCount").default(0).notNull(),
  maxDownloads: int("maxDownloads").default(5).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  // Revocation: set by admin to immediately invalidate the token (e.g. after refund)
  // revokedAt is the timestamp of revocation; revokedBy is the admin user's DB id
  revokedAt: timestamp("revokedAt"),
  revokedBy: int("revokedBy"),
});

export type DownloadToken = typeof downloadTokens.$inferSelect;
export type InsertDownloadToken = typeof downloadTokens.$inferInsert;
