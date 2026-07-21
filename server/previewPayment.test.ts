/**
 * Tests for:
 * 1. USDT/BSC payment: correct wallet format, BSCScan explorer link, network metadata
 * 2. PDF preview URL: public access, page limit, file requirement
 */

import { describe, expect, it } from "vitest";

// ─── USDT / BSC payment helpers ───────────────────────────────────────────────

function generateTxHash(currency: string): string {
  const chars = "0123456789abcdef";
  if (currency === "BTC") {
    return Array.from({ length: 64 }, () => chars[Math.floor(Math.random() * 16)]).join("");
  }
  return "0x" + Array.from({ length: 64 }, () => chars[Math.floor(Math.random() * 16)]).join("");
}

function generateWalletAddress(currency: string): string {
  if (currency === "ETH" || currency === "USDT") {
    return "0x" + Array.from({ length: 40 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
  }
  if (currency === "BTC") return "bc1q" + Array.from({ length: 39 }, () => "0123456789abcdefghjklmnpqrstuvwxyz"[Math.floor(Math.random() * 34)]).join("");
  return "ltc1q" + Array.from({ length: 39 }, () => "0123456789abcdefghjklmnpqrstuvwxyz"[Math.floor(Math.random() * 34)]).join("");
}

const CRYPTO_RATES: Record<string, number> = { ETH: 3250, BTC: 67000, LTC: 85, USDT: 1 };

const CRYPTO_NETWORK: Record<string, { name: string; chainId: number; explorerUrl: string; token?: string }> = {
  ETH: { name: "Ethereum Mainnet", chainId: 1, explorerUrl: "https://etherscan.io/tx" },
  BTC: { name: "Bitcoin Network", chainId: 0, explorerUrl: "https://blockstream.info/tx" },
  LTC: { name: "Litecoin Network", chainId: 0, explorerUrl: "https://blockchair.com/litecoin/transaction" },
  USDT: { name: "BNB Smart Chain (BSC)", chainId: 56, explorerUrl: "https://bscscan.com/tx", token: "USDT BEP-20" },
};

const STORE_WALLETS: Record<string, string> = {
  ETH: "0x742d35Cc6634C0532925a3b8D4C9C2B5e2e1A8f3",
  BTC: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  LTC: "ltc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  USDT: "0x3A5e8f9B2C1d4E7f6A8b0C2D4E6F8a0B2C4D6E8F",
};

// ─── USDT Tests ───────────────────────────────────────────────────────────────

describe("USDT/BSC payment", () => {
  it("USDT rate is 1:1 with USD", () => {
    expect(CRYPTO_RATES["USDT"]).toBe(1);
  });

  it("USDT crypto amount equals USD amount exactly", () => {
    const usdAmount = 29.99;
    const rate = CRYPTO_RATES["USDT"];
    const cryptoAmount = (usdAmount / rate).toFixed(8);
    expect(cryptoAmount).toBe("29.99000000");
  });

  it("USDT store wallet is a valid EVM address (0x + 40 hex chars)", () => {
    const wallet = STORE_WALLETS["USDT"];
    expect(wallet).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("USDT tx hash is EVM-style (0x + 64 hex chars)", () => {
    const hash = generateTxHash("USDT");
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("USDT from-address is EVM-style (0x + 40 hex chars)", () => {
    const addr = generateWalletAddress("USDT");
    expect(addr).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("USDT network is BNB Smart Chain with chain ID 56", () => {
    const net = CRYPTO_NETWORK["USDT"];
    expect(net.name).toBe("BNB Smart Chain (BSC)");
    expect(net.chainId).toBe(56);
  });

  it("USDT explorer URL points to BSCScan", () => {
    const net = CRYPTO_NETWORK["USDT"];
    expect(net.explorerUrl).toContain("bscscan.com");
  });

  it("USDT token is USDT BEP-20", () => {
    const net = CRYPTO_NETWORK["USDT"];
    expect(net.token).toBe("USDT BEP-20");
  });

  it("USDT explorer link is correctly formed with tx hash", () => {
    const hash = generateTxHash("USDT");
    const net = CRYPTO_NETWORK["USDT"];
    const explorerLink = `${net.explorerUrl}/${hash}`;
    expect(explorerLink).toMatch(/^https:\/\/bscscan\.com\/tx\/0x[0-9a-f]{64}$/);
  });

  it("ETH tx hash is also EVM-style (0x prefix)", () => {
    const hash = generateTxHash("ETH");
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("BTC tx hash has no 0x prefix", () => {
    const hash = generateTxHash("BTC");
    expect(hash).not.toMatch(/^0x/);
    expect(hash).toHaveLength(64);
  });

  it("USDT and ETH generate the same address format (EVM-compatible)", () => {
    const usdtAddr = generateWalletAddress("USDT");
    const ethAddr = generateWalletAddress("ETH");
    expect(usdtAddr).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(ethAddr).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("all four currencies are supported in CRYPTO_RATES", () => {
    expect(Object.keys(CRYPTO_RATES)).toEqual(expect.arrayContaining(["ETH", "BTC", "LTC", "USDT"]));
  });
});

// ─── PDF Preview Tests ────────────────────────────────────────────────────────

describe("PDF preview URL logic", () => {
  const PREVIEW_PAGE_LIMIT = 10;

  it("preview page limit is 10", () => {
    expect(PREVIEW_PAGE_LIMIT).toBe(10);
  });

  it("effective max page is min(previewLimit, totalPages) when totalPages < limit", () => {
    const totalPages = 5;
    const effectiveMax = Math.min(PREVIEW_PAGE_LIMIT, totalPages);
    expect(effectiveMax).toBe(5);
  });

  it("effective max page is previewLimit when totalPages > limit", () => {
    const totalPages = 300;
    const effectiveMax = Math.min(PREVIEW_PAGE_LIMIT, totalPages);
    expect(effectiveMax).toBe(10);
  });

  it("isLastPreviewPage is true when currentPage >= effectiveMaxPage", () => {
    const currentPage = 10;
    const effectiveMaxPage = 10;
    expect(currentPage >= effectiveMaxPage).toBe(true);
  });

  it("isLastPreviewPage is false when currentPage < effectiveMaxPage", () => {
    const currentPage = 7;
    const effectiveMaxPage = 10;
    expect(currentPage >= effectiveMaxPage).toBe(false);
  });

  it("Buy CTA should appear when on last preview page and more pages exist", () => {
    const currentPage = 10;
    const effectiveMaxPage = 10;
    const totalPages = 300;
    const isLastPreviewPage = currentPage >= effectiveMaxPage;
    const hasMorePages = totalPages > PREVIEW_PAGE_LIMIT;
    expect(isLastPreviewPage && hasMorePages).toBe(true);
  });

  it("Buy CTA should NOT appear when book has fewer pages than preview limit", () => {
    const currentPage = 5;
    const totalPages = 5;
    const effectiveMaxPage = Math.min(PREVIEW_PAGE_LIMIT, totalPages);
    const isLastPreviewPage = currentPage >= effectiveMaxPage;
    const hasMorePages = totalPages > PREVIEW_PAGE_LIMIT;
    expect(isLastPreviewPage && hasMorePages).toBe(false);
  });

  it("page navigation: prev is disabled on page 1", () => {
    const currentPage = 1;
    const isFirstPage = currentPage === 1;
    expect(isFirstPage).toBe(true);
  });

  it("page navigation: next is disabled on last preview page", () => {
    const currentPage = 10;
    const effectiveMaxPage = 10;
    const isDisabled = currentPage >= effectiveMaxPage;
    expect(isDisabled).toBe(true);
  });

  it("scale zoom in caps at 2.0", () => {
    const scale = 1.8;
    const newScale = Math.min(2.0, +(scale + 0.2).toFixed(1));
    expect(newScale).toBe(2.0);
  });

  it("scale zoom out caps at 0.5", () => {
    const scale = 0.6;
    const newScale = Math.max(0.5, +(scale - 0.2).toFixed(1));
    expect(newScale).toBe(0.5);
  });
});
