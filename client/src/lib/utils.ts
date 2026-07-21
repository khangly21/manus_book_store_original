import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: string | number): string {
  return `$${Number(price).toFixed(2)}`;
}

export function formatCrypto(amount: string | number, currency: string): string {
  return `${Number(amount).toFixed(8)} ${currency}`;
}

export function truncateHash(hash: string, chars = 8): string {
  if (!hash) return "";
  return `${hash.slice(0, chars)}...${hash.slice(-chars)}`;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function getGenreColor(genre: string): string {
  const colors: Record<string, string> = {
    Technology: "oklch(0.55 0.15 250)",
    Business: "oklch(0.55 0.15 145)",
    Science: "oklch(0.55 0.15 200)",
    Fiction: "oklch(0.55 0.15 300)",
    Thriller: "oklch(0.55 0.15 25)",
  };
  return colors[genre] || "oklch(0.50 0.05 250)";
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: "text-yellow-400",
    paid: "text-green-400",
    processing: "text-blue-400",
    shipped: "text-purple-400",
    delivered: "text-green-500",
    cancelled: "text-red-400",
    confirmed: "text-green-400",
    confirming: "text-yellow-400",
    failed: "text-red-400",
  };
  return colors[status] || "text-gray-400";
}

export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
