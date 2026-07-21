import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn, formatPrice, formatDate } from "@/lib/utils";
import {
  BookOpen, Clock, Heart, LogOut, Package, ShoppingBag, Star, User, ChevronRight, Trash2, Download, Loader2, Mail
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

type ProfileTab = "orders" | "wishlist" | "account";

export default function Profile() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [tab, setTab] = useState<ProfileTab>("orders");
  const utils = trpc.useUtils();

  const { data: orders } = trpc.orders.myOrders.useQuery(undefined, { enabled: isAuthenticated });
  const { data: wishlist } = trpc.wishlist.get.useQuery(undefined, { enabled: isAuthenticated && tab === "wishlist" });

  const downloadMutation = trpc.books.download.useMutation({
    onSuccess: (data) => {
      const a = document.createElement("a");
      a.href = data.url;
      a.download = data.fileName || "book.pdf";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Download started!");
    },
    onError: (err) => toast.error("Download failed", { description: err.message }),
  });

  const removeWishlist = trpc.wishlist.toggle.useMutation({
    onSuccess: () => { utils.wishlist.get.invalidate(); utils.wishlist.getIds.invalidate(); toast.success("Removed from wishlist"); },
  });

  const resendEmailMutation = trpc.books.resendDeliveryEmail.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Delivery email resent!", {
          description: `Signed download links sent to ${data.sentTo}. Valid for 48 hours.`,
        });
      } else {
        toast.error("Could not resend email", { description: "Please try again or contact support." });
      }
    },
    onError: (err) => toast.error("Resend failed", { description: err.message }),
  });

  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <User className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-display text-2xl font-bold text-foreground mb-2">Sign In Required</h2>
          <p className="text-muted-foreground mb-6">Please sign in to view your profile, orders, and wishlist.</p>
          <a href={getLoginUrl()} className="btn-gold px-8 py-3 rounded-xl font-bold inline-block">Sign In</a>
        </div>
      </div>
    );
  }

  const TABS: { key: ProfileTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "orders", label: "Orders", icon: <Package className="w-4 h-4" />, count: orders?.length },
    { key: "wishlist", label: "Wishlist", icon: <Heart className="w-4 h-4" /> },
    { key: "account", label: "Account", icon: <User className="w-4 h-4" /> },
  ];

  const getStatusColor = (status: string) => {
    if (status === "paid" || status === "delivered") return "bg-green-500/20 text-green-400";
    if (status === "pending") return "bg-yellow-500/20 text-yellow-400";
    if (status === "cancelled") return "bg-red-500/20 text-red-400";
    return "bg-blue-500/20 text-blue-400";
  };

  return (
    <div className="min-h-screen pt-20 page-enter">
      <div className="container py-8">
        {/* Profile Header */}
        <div className="flex items-center gap-5 mb-8 p-6 bg-card border border-border rounded-2xl">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-2xl font-bold text-primary border border-primary/20">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-foreground">{user?.name || "Book Lover"}</h1>
            <p className="text-muted-foreground">{user?.email || "Member"}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium border border-primary/20">
                {user?.role === "admin" ? "Admin" : "Member"}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> Member since {user?.createdAt ? formatDate(user.createdAt) : "—"}
              </span>
            </div>
          </div>
          {user?.role === "admin" && (
            <Link href="/admin" className="hidden md:flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 text-primary rounded-xl text-sm font-medium hover:bg-primary/20 transition-colors">
              Admin Dashboard <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-6 w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.icon} {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="bg-primary text-primary-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Orders Tab */}
        {tab === "orders" && (
          <div className="space-y-4">
            {orders && orders.length > 0 ? orders.map((order: any) => (
              <div key={order.id} className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/20 transition-colors">
                <div className="flex items-center justify-between p-4 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Order #{order.id}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", getStatusColor(order.status))}>
                      {order.status}
                    </span>
                    <span className="font-bold text-primary">{formatPrice(order.totalAmount)}</span>
                  </div>
                </div>
                {order.items && order.items.length > 0 && (
                  <div className="p-4 space-y-2">
                    {order.items.slice(0, 3).map((item: any, i: number) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-8 h-10 rounded-lg overflow-hidden bg-navy-light flex-none">
                          {item.bookCover ? <img src={item.bookCover} alt="" className="w-full h-full object-cover" /> : <BookOpen className="w-4 h-4 text-primary/30 m-auto mt-2" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">{item.bookTitle}</p>
                          <p className="text-xs text-muted-foreground">by {item.bookAuthor} · Qty: {item.quantity}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{formatPrice(item.price * item.quantity)}</span>
                          {/* Download button — shown for paid orders with a file available */}
                          {(order.paymentStatus === "confirmed" || order.status === "paid" || order.status === "delivered") && item.bookId && (
                            <button
                              onClick={() => downloadMutation.mutate({ bookId: item.bookId })}
                              disabled={downloadMutation.isPending}
                              title="Download book"
                              className="p-1.5 rounded-lg bg-green-600/10 border border-green-500/20 text-green-400 hover:bg-green-600/20 transition-colors flex-shrink-0"
                            >
                              {downloadMutation.isPending && downloadMutation.variables?.bookId === item.bookId
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Download className="w-3.5 h-3.5" />
                              }
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {order.items.length > 3 && (
                      <p className="text-xs text-muted-foreground pl-11">+{order.items.length - 3} more items</p>
                    )}
                  </div>
                )}
                {order.txHash && (
                  <div className="px-4 pb-4">
                    <div className="bg-secondary rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-muted-foreground">Transaction Hash</p>
                        {/* Resend delivery email — only for confirmed paid orders */}
                        {(order.paymentStatus === "confirmed" || order.status === "paid" || order.status === "delivered") && (
                          <button
                            onClick={() => resendEmailMutation.mutate({ orderId: order.id })}
                            disabled={resendEmailMutation.isPending && resendEmailMutation.variables?.orderId === order.id}
                            title="Resend delivery email with fresh signed download links"
                            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                          >
                            {resendEmailMutation.isPending && resendEmailMutation.variables?.orderId === order.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Mail className="w-3 h-3" />
                            }
                            Resend links
                          </button>
                        )}
                      </div>
                      <p className="text-xs font-mono text-foreground truncate">{order.txHash}</p>
                      {(order.paymentStatus === "confirmed" || order.status === "paid" || order.status === "delivered") && (
                        <p className="text-xs text-muted-foreground mt-1.5">
                          🔐 Download links are HMAC-SHA256 signed &bull; 48h expiry &bull; 5 downloads max
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )) : (
              <div className="text-center py-20">
                <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-display text-xl font-bold text-foreground mb-2">No orders yet</h3>
                <p className="text-muted-foreground mb-6">Start exploring our collection of premium books!</p>
                <Link href="/catalog" className="btn-gold px-8 py-3 rounded-xl font-bold inline-block">Browse Books</Link>
              </div>
            )}
          </div>
        )}

        {/* Wishlist Tab */}
        {tab === "wishlist" && (
          <div>
            {wishlist && wishlist.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {wishlist.map((item: any) => (
                  <div key={item.id} className="bg-card border border-border rounded-xl overflow-hidden group hover:border-primary/30 transition-all hover:-translate-y-0.5">
                    <Link href={`/book/${item.bookId}`}>
                      <div className="aspect-[3/4] bg-navy-light overflow-hidden">
                        {item.book?.coverUrl ? (
                          <img src={item.book.coverUrl} alt={item.book?.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BookOpen className="w-10 h-10 text-primary/30" />
                          </div>
                        )}
                      </div>
                    </Link>
                    <div className="p-3">
                      <Link href={`/book/${item.bookId}`}>
                        <h3 className="font-semibold text-foreground text-sm line-clamp-1 hover:text-primary transition-colors">{item.book?.title}</h3>
                      </Link>
                      <p className="text-xs text-muted-foreground mb-2">{item.book?.author}</p>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-primary text-sm">{formatPrice(item.book?.price || "0")}</span>
                        <button
                          onClick={() => removeWishlist.mutate({ bookId: item.bookId })}
                          className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-secondary transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-display text-xl font-bold text-foreground mb-2">Your wishlist is empty</h3>
                <p className="text-muted-foreground mb-6">Save books you love to your wishlist for later.</p>
                <Link href="/catalog" className="btn-gold px-8 py-3 rounded-xl font-bold inline-block">Browse Books</Link>
              </div>
            )}
          </div>
        )}

        {/* Account Tab */}
        {tab === "account" && (
          <div className="max-w-md space-y-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-4">Account Information</h3>
              <div className="space-y-3">
                {[
                  { label: "Name", value: user?.name || "—" },
                  { label: "Email", value: user?.email || "—" },
                  { label: "Role", value: user?.role || "user" },
                  { label: "Member Since", value: user?.createdAt ? formatDate(user.createdAt) : "—" },
                ].map((field) => (
                  <div key={field.label} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                    <span className="text-sm text-muted-foreground">{field.label}</span>
                    <span className="text-sm font-medium text-foreground">{field.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-4">Quick Stats</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Orders", value: orders?.length || 0, icon: <Package className="w-4 h-4" /> },
                  { label: "Wishlist", value: "—", icon: <Heart className="w-4 h-4" /> },
                  { label: "Reviews", value: "—", icon: <Star className="w-4 h-4" /> },
                ].map((stat) => (
                  <div key={stat.label} className="text-center p-3 bg-secondary rounded-xl">
                    <div className="flex justify-center text-primary mb-1">{stat.icon}</div>
                    <p className="text-lg font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => logout()}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl hover:bg-destructive/20 transition-colors font-medium"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
