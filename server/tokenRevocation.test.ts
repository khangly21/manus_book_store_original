/**
 * tokenRevocation.test.ts
 *
 * Router-level tests for the token revocation admin procedures:
 *   books.revokeOrderTokens
 *   books.restoreOrderTokens
 *   books.getOrderTokenStatus
 *
 * These tests verify:
 *  1. Admin-only guard: non-admin users receive FORBIDDEN
 *  2. Happy path: admin can revoke, restore, and query token status
 *  3. NOT_FOUND guard: procedures reject unknown order IDs
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB module ───────────────────────────────────────────────────────────

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getOrderById: vi.fn(),
    revokeTokensByOrderId: vi.fn(),
    restoreTokensByOrderId: vi.fn(),
    getOrderTokenStatus: vi.fn(),
  };
});

import * as db from "./db";

// ─── Context factories ────────────────────────────────────────────────────────

function makeCtx(role: "admin" | "user"): TrpcContext {
  return {
    user: {
      id: role === "admin" ? 1 : 99,
      openId: role === "admin" ? "admin-open-id" : "user-open-id",
      email: `${role}@example.com`,
      name: role === "admin" ? "Admin User" : "Regular User",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

const adminCtx = makeCtx("admin");
const userCtx = makeCtx("user");

// ─── books.revokeOrderTokens ──────────────────────────────────────────────────

describe("books.revokeOrderTokens", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(userCtx);
    await expect(caller.books.revokeOrderTokens({ orderId: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("throws NOT_FOUND when the order does not exist", async () => {
    vi.mocked(db.getOrderById).mockResolvedValue(undefined as any);
    const caller = appRouter.createCaller(adminCtx);
    await expect(caller.books.revokeOrderTokens({ orderId: 9999 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("returns success with revokedCount when order exists", async () => {
    vi.mocked(db.getOrderById).mockResolvedValue({
      id: 42,
      userId: 5,
      paymentStatus: "confirmed",
      status: "paid",
      totalAmount: "29.99",
      txHash: "0xabc",
      cryptoCurrency: "ETH",
      items: [],
      userName: "Test User",
      createdAt: new Date(),
    } as any);
    vi.mocked(db.revokeTokensByOrderId).mockResolvedValue(3);

    const caller = appRouter.createCaller(adminCtx);
    const result = await caller.books.revokeOrderTokens({ orderId: 42 });

    expect(result.success).toBe(true);
    expect(result.revokedCount).toBe(3);
    expect(result.orderId).toBe(42);
    expect(db.revokeTokensByOrderId).toHaveBeenCalledWith(42, adminCtx.user!.id);
  });

  it("returns revokedCount of 0 when no active tokens exist", async () => {
    vi.mocked(db.getOrderById).mockResolvedValue({ id: 7, userId: 5, items: [] } as any);
    vi.mocked(db.revokeTokensByOrderId).mockResolvedValue(0);

    const caller = appRouter.createCaller(adminCtx);
    const result = await caller.books.revokeOrderTokens({ orderId: 7 });

    expect(result.success).toBe(true);
    expect(result.revokedCount).toBe(0);
  });
});

// ─── books.restoreOrderTokens ─────────────────────────────────────────────────

describe("books.restoreOrderTokens", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(userCtx);
    await expect(caller.books.restoreOrderTokens({ orderId: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("throws NOT_FOUND when the order does not exist", async () => {
    vi.mocked(db.getOrderById).mockResolvedValue(undefined as any);
    const caller = appRouter.createCaller(adminCtx);
    await expect(caller.books.restoreOrderTokens({ orderId: 8888 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("returns success with restoredCount when order exists", async () => {
    vi.mocked(db.getOrderById).mockResolvedValue({ id: 55, userId: 5, items: [] } as any);
    vi.mocked(db.restoreTokensByOrderId).mockResolvedValue(2);

    const caller = appRouter.createCaller(adminCtx);
    const result = await caller.books.restoreOrderTokens({ orderId: 55 });

    expect(result.success).toBe(true);
    expect(result.restoredCount).toBe(2);
    expect(result.orderId).toBe(55);
    expect(db.restoreTokensByOrderId).toHaveBeenCalledWith(55);
  });

  it("returns restoredCount of 0 when no revoked tokens exist", async () => {
    vi.mocked(db.getOrderById).mockResolvedValue({ id: 10, userId: 5, items: [] } as any);
    vi.mocked(db.restoreTokensByOrderId).mockResolvedValue(0);

    const caller = appRouter.createCaller(adminCtx);
    const result = await caller.books.restoreOrderTokens({ orderId: 10 });

    expect(result.success).toBe(true);
    expect(result.restoredCount).toBe(0);
  });
});

// ─── books.getOrderTokenStatus ────────────────────────────────────────────────

describe("books.getOrderTokenStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws FORBIDDEN for non-admin users", async () => {
    const caller = appRouter.createCaller(userCtx);
    await expect(caller.books.getOrderTokenStatus({ orderId: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("returns token status breakdown for an order", async () => {
    const mockStatus = { total: 4, active: 1, revoked: 1, expired: 2 };
    vi.mocked(db.getOrderTokenStatus).mockResolvedValue(mockStatus as any);

    const caller = appRouter.createCaller(adminCtx);
    const result = await caller.books.getOrderTokenStatus({ orderId: 42 });

    expect(result).toEqual(mockStatus);
    expect(db.getOrderTokenStatus).toHaveBeenCalledWith(42);
  });

  it("returns zeros when no tokens exist for the order", async () => {
    const mockStatus = { total: 0, active: 0, revoked: 0, expired: 0 };
    vi.mocked(db.getOrderTokenStatus).mockResolvedValue(mockStatus as any);

    const caller = appRouter.createCaller(adminCtx);
    const result = await caller.books.getOrderTokenStatus({ orderId: 999 });

    expect(result.total).toBe(0);
    expect(result.active).toBe(0);
  });
});
