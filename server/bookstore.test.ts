import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB module ──────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getBooks: vi.fn().mockResolvedValue({ books: [], total: 0 }),
  getBookById: vi.fn().mockResolvedValue(null),
  getFeaturedBooks: vi.fn().mockResolvedValue([]),
  getBestsellerBooks: vi.fn().mockResolvedValue([]),
  getBooksByGenre: vi.fn().mockResolvedValue([]),
  getReviewsByBookId: vi.fn().mockResolvedValue([]),
  getCartItems: vi.fn().mockResolvedValue([]),
  addToCart: vi.fn().mockResolvedValue(undefined),
  updateCartItem: vi.fn().mockResolvedValue(undefined),
  removeFromCart: vi.fn().mockResolvedValue(undefined),
  clearCart: vi.fn().mockResolvedValue(undefined),
  getWishlist: vi.fn().mockResolvedValue([]),
  getWishlistBookIds: vi.fn().mockResolvedValue([]),
  toggleWishlist: vi.fn().mockResolvedValue(true),
  getOrdersByUserId: vi.fn().mockResolvedValue([]),
  getAllOrders: vi.fn().mockResolvedValue([]),
  getAdminStats: vi.fn().mockResolvedValue({ totalRevenue: 0, totalOrders: 0, totalBooks: 0, totalUsers: 0 }),
  getTopBooks: vi.fn().mockResolvedValue([]),
  getRecentOrders: vi.fn().mockResolvedValue([]),
  getActiveKnowledge: vi.fn().mockResolvedValue([]),
  getAllKnowledge: vi.fn().mockResolvedValue([]),
}));

// ─── Context helpers ─────────────────────────────────────────────────────────
function createPublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUserCtx(): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "user-42",
      name: "Test Reader",
      email: "reader@test.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createAdminCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-1",
      name: "Admin",
      email: "admin@test.com",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe("auth router", () => {
  it("me returns null for unauthenticated user", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("me returns user for authenticated user", async () => {
    const caller = appRouter.createCaller(createUserCtx());
    const result = await caller.auth.me();
    expect(result?.name).toBe("Test Reader");
    expect(result?.role).toBe("user");
  });

  it("logout clears session cookie", async () => {
    const ctx = createUserCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(ctx.res.clearCookie).toHaveBeenCalled();
  });
});

describe("books router", () => {
  it("list returns books and total", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.books.list({});
    expect(result).toHaveProperty("books");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.books)).toBe(true);
  });

  it("featured returns array", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.books.featured();
    expect(Array.isArray(result)).toBe(true);
  });

  it("bestsellers returns array", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.books.bestsellers();
    expect(Array.isArray(result)).toBe(true);
  });

  it("genres returns the 5 genre strings", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.books.genres();
    expect(result).toContain("Technology");
    expect(result).toContain("Fiction");
    expect(result.length).toBe(5);
  });

  it("getById throws NOT_FOUND for missing book", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.books.getById({ id: 9999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("delete is forbidden for non-admin", async () => {
    const caller = appRouter.createCaller(createUserCtx());
    await expect(caller.books.delete({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("cart router", () => {
  it("get returns cart items for authenticated user", async () => {
    const caller = appRouter.createCaller(createUserCtx());
    const result = await caller.cart.get();
    expect(Array.isArray(result)).toBe(true);
  });

  it("get throws UNAUTHORIZED for unauthenticated user", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.cart.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("wishlist router", () => {
  it("get returns wishlist for authenticated user", async () => {
    const caller = appRouter.createCaller(createUserCtx());
    const result = await caller.wishlist.get();
    expect(Array.isArray(result)).toBe(true);
  });

  it("toggle returns added boolean", async () => {
    const caller = appRouter.createCaller(createUserCtx());
    const result = await caller.wishlist.toggle({ bookId: 1 });
    expect(result).toHaveProperty("added");
    expect(typeof result.added).toBe("boolean");
  });
});

describe("payment router", () => {
  it("getRates returns crypto rates", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const rates = await caller.payment.getRates();
    expect(rates).toHaveProperty("ETH");
    expect(rates).toHaveProperty("BTC");
    expect(rates).toHaveProperty("LTC");
    expect(typeof rates.ETH).toBe("number");
    expect(rates.ETH).toBeGreaterThan(0);
  });
});

describe("admin router", () => {
  it("stats is forbidden for regular user", async () => {
    const caller = appRouter.createCaller(createUserCtx());
    await expect(caller.admin.stats()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("stats returns analytics for admin", async () => {
    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.admin.stats();
    expect(result).toHaveProperty("totalRevenue");
    expect(result).toHaveProperty("totalOrders");
    expect(result).toHaveProperty("totalBooks");
    expect(result).toHaveProperty("totalUsers");
  });

  it("chatbot getKnowledge is forbidden for regular user", async () => {
    const caller = appRouter.createCaller(createUserCtx());
    await expect(caller.chatbot.getKnowledge()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("chatbot getKnowledge returns array for admin", async () => {
    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.chatbot.getKnowledge();
    expect(Array.isArray(result)).toBe(true);
  });
});
