import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn, formatPrice, formatDate } from "@/lib/utils";
import {
  BarChart3, BookOpen, Bot, CheckCircle, Edit2, MessageSquare, Package,
  Plus, Shield, ShoppingBag, Star, Trash2, TrendingUp, Users, X, Loader2, Save, Upload, FileText,
  ShieldOff, ShieldCheck, AlertTriangle
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import BookFileUploader from "@/components/BookFileUploader";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Tab = "overview" | "books" | "orders" | "chatbot";

interface KBEntry {
  id?: number;
  category: string;
  question: string;
  answer: string;
  keywords?: string;
  active: boolean;
  priority: number;
}

const EMPTY_KB: KBEntry = { category: "general", question: "", answer: "", keywords: "", active: true, priority: 0 };
const EMPTY_BOOK = { title: "", author: "", genre: "Technology", price: "", originalPrice: "", description: "", isbn: "", pages: "", publishedYear: "", language: "English", authorBio: "", coverUrl: "", featured: false, bestseller: false };

export default function Admin() {
  const { user, isAuthenticated } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [editingKB, setEditingKB] = useState<KBEntry | null>(null);
  const [editingBook, setEditingBook] = useState<any | null>(null);
  const [bookForm, setBookForm] = useState(EMPTY_BOOK);
  const [showBookForm, setShowBookForm] = useState(false);
  const [fileUploadBookId, setFileUploadBookId] = useState<number | null>(null);
  const [fileUploadBook, setFileUploadBook] = useState<any | null>(null);
  // Revocation dialog state
  const [revokeDialog, setRevokeDialog] = useState<{ orderId: number; orderRef: string } | null>(null);
  const [restoreDialog, setRestoreDialog] = useState<{ orderId: number; orderRef: string } | null>(null);
  const utils = trpc.useUtils();

  const { data: stats } = trpc.admin.stats.useQuery();
  const { data: topBooks } = trpc.admin.topBooks.useQuery();
  const { data: recentOrders } = trpc.admin.recentOrders.useQuery();
  const { data: allBooks } = trpc.books.list.useQuery({ limit: 200 }, { enabled: tab === "books" });
  const { data: allOrders } = trpc.orders.all.useQuery(undefined, { enabled: tab === "orders" });
  const { data: knowledge } = trpc.chatbot.getKnowledge.useQuery(undefined, { enabled: tab === "chatbot" });

  const upsertKB = trpc.chatbot.upsertKnowledge.useMutation({
    onSuccess: () => { utils.chatbot.getKnowledge.invalidate(); setEditingKB(null); toast.success("Knowledge base updated!"); },
  });
  const deleteKB = trpc.chatbot.deleteKnowledge.useMutation({
    onSuccess: () => { utils.chatbot.getKnowledge.invalidate(); toast.success("Entry deleted"); },
  });
  const createBook = trpc.books.create.useMutation({
    onSuccess: () => { utils.books.list.invalidate(); setShowBookForm(false); setEditingBook(null); setBookForm(EMPTY_BOOK); toast.success("Book created!"); },
  });
  const updateBook = trpc.books.update.useMutation({
    onSuccess: () => { utils.books.list.invalidate(); setShowBookForm(false); setEditingBook(null); setBookForm(EMPTY_BOOK); toast.success("Book updated!"); },
  });
  const deleteBook = trpc.books.delete.useMutation({
    onSuccess: () => { utils.books.list.invalidate(); toast.success("Book deleted"); },
  });
  const updateOrderStatus = trpc.orders.updateStatus.useMutation({
    onSuccess: () => { utils.orders.all.invalidate(); toast.success("Order status updated"); },
  });

  // Token status query — only fetches when a dialog is open
  const tokenStatusQuery = trpc.books.getOrderTokenStatus.useQuery(
    { orderId: revokeDialog?.orderId ?? restoreDialog?.orderId ?? 0 },
    { enabled: !!(revokeDialog || restoreDialog) }
  );

  const revokeTokensMutation = trpc.books.revokeOrderTokens.useMutation({
    onSuccess: (data) => {
      utils.orders.all.invalidate();
      setRevokeDialog(null);
      toast.success(
        data.revokedCount > 0
          ? `🔒 Revoked ${data.revokedCount} download link${data.revokedCount !== 1 ? "s" : ""} for order #${data.orderId}`
          : "No active links to revoke — they may have already expired.",
        { duration: 5000 }
      );
    },
    onError: (err) => toast.error("Revocation failed", { description: err.message }),
  });

  const restoreTokensMutation = trpc.books.restoreOrderTokens.useMutation({
    onSuccess: (data) => {
      utils.orders.all.invalidate();
      setRestoreDialog(null);
      toast.success(
        data.restoredCount > 0
          ? `🔓 Restored ${data.restoredCount} download link${data.restoredCount !== 1 ? "s" : ""} for order #${data.orderId}`
          : "No revoked links found for this order.",
        { duration: 5000 }
      );
    },
    onError: (err) => toast.error("Restore failed", { description: err.message }),
  });

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-display text-2xl font-bold text-foreground mb-2">Admin Access Required</h2>
          <p className="text-muted-foreground mb-4">You don't have permission to access this page.</p>
          <Link href="/" className="btn-gold px-6 py-2.5 rounded-xl font-bold inline-block">Go Home</Link>
        </div>
      </div>
    );
  }

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview", icon: <BarChart3 className="w-4 h-4" /> },
    { key: "books", label: "Books", icon: <BookOpen className="w-4 h-4" /> },
    { key: "orders", label: "Orders", icon: <Package className="w-4 h-4" /> },
    { key: "chatbot", label: "AI Training", icon: <Bot className="w-4 h-4" /> },
  ];

  const handleSaveBook = () => {
    const bookData = {
      ...bookForm,
      price: bookForm.price,
      originalPrice: bookForm.originalPrice || undefined,
      pages: bookForm.pages ? Number(bookForm.pages) : undefined,
      publishedYear: bookForm.publishedYear ? Number(bookForm.publishedYear) : undefined,
    };
    if (editingBook?.id) {
      updateBook.mutate({ id: editingBook.id, ...bookData });
    } else {
      createBook.mutate(bookData);
    }
  };
  const isBookSaving = createBook.isPending || updateBook.isPending;

  return (
    <div className="min-h-screen pt-20 page-enter">
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-5 h-5 text-primary" />
              <span className="text-primary text-sm font-semibold uppercase tracking-wider">Admin Panel</span>
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground">Dashboard</h1>
          </div>
          <div className="text-sm text-muted-foreground">Welcome, <span className="text-foreground font-medium">{user?.name}</span></div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-8 w-fit">
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
            </button>
          ))}
        </div>

        {/* ── Overview Tab ─────────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div className="space-y-8">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Revenue", value: formatPrice(stats?.totalRevenue ?? 0), icon: <TrendingUp className="w-5 h-5 text-green-400" />, color: "text-green-400" },
                { label: "Total Orders", value: stats?.totalOrders?.toLocaleString() ?? "0", icon: <ShoppingBag className="w-5 h-5 text-blue-400" />, color: "text-blue-400" },
                { label: "Total Books", value: stats?.totalBooks?.toLocaleString() ?? "0", icon: <BookOpen className="w-5 h-5 text-primary" />, color: "text-primary" },
                { label: "Total Users", value: stats?.totalUsers?.toLocaleString() ?? "0", icon: <Users className="w-5 h-5 text-purple-400" />, color: "text-purple-400" },
              ].map((stat) => (
                <div key={stat.label} className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-muted-foreground">{stat.label}</span>
                    {stat.icon}
                  </div>
                  <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Top Books */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-display text-lg font-bold text-foreground mb-4">Top Selling Books</h3>
                {topBooks && topBooks.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={topBooks.slice(0, 5)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" />
                      <XAxis dataKey="title" tick={{ fill: "oklch(0.65 0 0)", fontSize: 10 }} tickFormatter={(v) => v.length > 12 ? v.slice(0, 12) + "…" : v} />
                      <YAxis tick={{ fill: "oklch(0.65 0 0)", fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: "oklch(0.18 0.02 250)", border: "1px solid oklch(0.3 0 0)", borderRadius: "8px", color: "oklch(0.9 0 0)" }} />
                      <Bar dataKey="salesCount" fill="oklch(0.78 0.17 85)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No sales data yet</div>}
              </div>

              {/* Recent Orders */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-display text-lg font-bold text-foreground mb-4">Recent Orders</h3>
                <div className="space-y-3">
                  {recentOrders?.slice(0, 5).map((order) => (
                    <div key={order.id} className="flex items-center justify-between py-2 border-b border-border/50">
                      <div>
                        <p className="text-sm font-medium text-foreground">Order #{order.id}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-primary">{formatPrice(order.totalAmount)}</p>
                        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", order.status === "paid" || order.status === "delivered" ? "bg-green-500/20 text-green-400" : order.status === "pending" ? "bg-yellow-500/20 text-yellow-400" : "bg-blue-500/20 text-blue-400")}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {(!recentOrders || recentOrders.length === 0) && <p className="text-sm text-muted-foreground text-center py-8">No orders yet</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Books Tab ────────────────────────────────────────────────────── */}
        {tab === "books" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl font-bold text-foreground">Book Catalog ({allBooks?.total ?? 0})</h2>
              <button
                onClick={() => { setEditingBook(null); setBookForm(EMPTY_BOOK); setShowBookForm(true); }}
                className="btn-gold px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add Book
              </button>
            </div>

            {/* Book Form Modal */}
            {showBookForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowBookForm(false)} />
                <div className="relative bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between p-5 border-b border-border">
                    <h3 className="font-display text-lg font-bold text-foreground">{editingBook ? "Edit Book" : "Add New Book"}</h3>
                    <button onClick={() => setShowBookForm(false)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="p-5 grid grid-cols-2 gap-4">
                    {[
                      { key: "title", label: "Title", full: true },
                      { key: "author", label: "Author" },
                      { key: "isbn", label: "ISBN" },
                      { key: "price", label: "Price ($)" },
                      { key: "originalPrice", label: "Original Price ($)" },
                      { key: "pages", label: "Pages" },
                      { key: "publishedYear", label: "Published Year" },
                      { key: "language", label: "Language" },
                      { key: "coverUrl", label: "Cover Image URL", full: true },
                    ].map((f) => (
                      <div key={f.key} className={f.full ? "col-span-2" : ""}>
                        <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
                        <input
                          value={(bookForm as any)[f.key] || ""}
                          onChange={(e) => setBookForm((b) => ({ ...b, [f.key]: e.target.value }))}
                          className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Genre</label>
                      <select value={bookForm.genre} onChange={(e) => setBookForm((b) => ({ ...b, genre: e.target.value }))} className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50">
                        {["Technology", "Business", "Science", "Fiction", "Thriller"].map((g) => <option key={g}>{g}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-4 pt-5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={bookForm.featured} onChange={(e) => setBookForm((b) => ({ ...b, featured: e.target.checked }))} className="accent-primary" />
                        <span className="text-sm text-foreground">Featured</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={bookForm.bestseller} onChange={(e) => setBookForm((b) => ({ ...b, bestseller: e.target.checked }))} className="accent-primary" />
                        <span className="text-sm text-foreground">Bestseller</span>
                      </label>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                      <textarea
                        value={bookForm.description}
                        onChange={(e) => setBookForm((b) => ({ ...b, description: e.target.value }))}
                        rows={3}
                        className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 resize-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground mb-1 block">Author Bio</label>
                      <textarea
                        value={bookForm.authorBio}
                        onChange={(e) => setBookForm((b) => ({ ...b, authorBio: e.target.value }))}
                        rows={2}
                        className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 resize-none"
                      />
                    </div>
                    {/* File Upload — only shown when editing an existing book */}
                    {editingBook?.id && (
                      <div className="col-span-2">
                        <div className="flex items-center gap-2 mb-2">
                          <Upload className="w-4 h-4 text-primary" />
                          <label className="text-xs font-semibold text-primary uppercase tracking-wider">Book File (PDF / ePub)</label>
                        </div>
                        <BookFileUploader
                          bookId={editingBook.id}
                          bookTitle={editingBook.title}
                          currentFile={{
                            fileName: editingBook.fileName,
                            fileSize: editingBook.fileSize,
                            fileHash: editingBook.fileHash,
                            fileMimeType: editingBook.fileMimeType,
                            fileUrl: editingBook.fileUrl,
                          }}
                          onUploadSuccess={(hash) => {
                            setEditingBook((b: any) => ({ ...b, fileHash: hash }));
                            utils.books.list.invalidate();
                          }}
                          onRemoveSuccess={() => {
                            setEditingBook((b: any) => ({ ...b, fileName: null, fileHash: null, fileSize: null }));
                            utils.books.list.invalidate();
                          }}
                        />
                      </div>
                    )}
                    {!editingBook?.id && (
                      <div className="col-span-2 flex items-center gap-2 p-3 rounded-lg bg-secondary/50 border border-dashed border-border">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Save the book first, then you can upload a PDF or ePub file for delivery.</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 p-5 border-t border-border">
                    <button onClick={() => setShowBookForm(false)} className="px-5 py-2.5 rounded-lg border border-border text-foreground hover:bg-secondary transition-colors text-sm">Cancel</button>
                    <button onClick={handleSaveBook}                   disabled={isBookSaving || !bookForm.title || !bookForm.price} className="btn-gold flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                      {isBookSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Book</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Book</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Genre</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rating</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Badges</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">File</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allBooks?.books?.map((book: any) => (
                      <tr key={book.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-12 rounded-lg overflow-hidden bg-navy-light flex-none">
                              {book.coverUrl ? <img src={book.coverUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><BookOpen className="w-4 h-4 text-primary/30" /></div>}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground line-clamp-1">{book.title}</p>
                              <p className="text-xs text-muted-foreground">{book.author}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><span className="genre-badge">{book.genre}</span></td>
                        <td className="px-4 py-3 text-sm font-bold text-primary">{formatPrice(book.price)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-primary fill-current" />
                            <span className="text-sm text-foreground">{Number(book.rating ?? 0).toFixed(1)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {book.featured && <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">Featured</span>}
                            {book.bestseller && <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">Bestseller</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {book.fileName ? (
                            <div className="flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-green-400" />
                              <span className="text-xs text-green-400 font-medium">Uploaded</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No file</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => { setEditingBook(book); setBookForm({ title: book.title, author: book.author, genre: book.genre, price: book.price, originalPrice: book.originalPrice || "", description: book.description || "", isbn: book.isbn || "", pages: String(book.pages || ""), publishedYear: String(book.publishedYear || ""), language: book.language || "English", authorBio: book.authorBio || "", coverUrl: book.coverUrl || "", featured: book.featured ?? false, bestseller: book.bestseller ?? false }); setShowBookForm(true); }}
                              className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-secondary transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { if (confirm("Delete this book?")) deleteBook.mutate({ id: book.id }); }}
                              className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-secondary transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!allBooks?.books || allBooks.books.length === 0) && <div className="py-16 text-center text-muted-foreground">No books found</div>}
              </div>
            </div>
          </div>
        )}

        {/* ── Orders Tab ───────────────────────────────────────────────────── */}
        {tab === "orders" && (
          <div>
            <h2 className="font-display text-xl font-bold text-foreground mb-5">All Orders ({allOrders?.length ?? 0})</h2>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Order</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Access</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Update</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allOrders?.map((order: any) => (
                      <tr key={order.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono text-foreground">#{order.id}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{order.userName || "—"}</td>
                        <td className="px-4 py-3 text-sm font-bold text-primary">{formatPrice(order.totalAmount)}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono text-muted-foreground">{order.cryptoCurrency || "—"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("text-xs font-medium px-2 py-1 rounded-full", order.status === "paid" || order.status === "delivered" ? "bg-green-500/20 text-green-400" : order.status === "pending" ? "bg-yellow-500/20 text-yellow-400" : order.status === "cancelled" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400")}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(order.createdAt)}</td>
                        {/* Revoke / Restore Access column */}
                        <td className="px-4 py-3">
                          {order.paymentStatus === "confirmed" ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setRevokeDialog({ orderId: order.id, orderRef: `#${order.id}` })}
                                title="Revoke all download links for this order"
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
                              >
                                <ShieldOff className="w-3 h-3" /> Revoke
                              </button>
                              <button
                                onClick={() => setRestoreDialog({ orderId: order.id, orderRef: `#${order.id}` })}
                                title="Restore previously revoked download links"
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-colors"
                              >
                                <ShieldCheck className="w-3 h-3" /> Restore
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/50 block text-center">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={order.status}
                            onChange={(e) => updateOrderStatus.mutate({ id: order.id, status: e.target.value as any })}
                            className="bg-secondary border border-border rounded-lg px-2 py-1 text-xs text-foreground outline-none focus:border-primary/50 cursor-pointer"
                          >
                            {["pending", "paid", "processing", "shipped", "delivered", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!allOrders || allOrders.length === 0) && <div className="py-16 text-center text-muted-foreground">No orders yet</div>}
              </div>
            </div>
          </div>
        )}

        {/* ── Revoke Access Confirmation Dialog ──────────────────────────── */}
        <AlertDialog open={!!revokeDialog} onOpenChange={(open) => !open && setRevokeDialog(null)}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-foreground">
                <ShieldOff className="w-5 h-5 text-red-400" />
                Revoke Download Access
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p className="text-muted-foreground">
                    This will immediately invalidate <strong className="text-foreground">all active download links</strong> for
                    order <strong className="text-primary">{revokeDialog?.orderRef}</strong>.
                    Customers will receive a "link revoked" error if they try to use them.
                  </p>
                  {tokenStatusQuery.data && (
                    <div className="bg-secondary rounded-lg p-3 border border-border text-sm">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-lg font-bold text-green-400">{tokenStatusQuery.data.active}</p>
                          <p className="text-xs text-muted-foreground">Active links</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-yellow-400">{tokenStatusQuery.data.expired}</p>
                          <p className="text-xs text-muted-foreground">Expired</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-red-400">{tokenStatusQuery.data.revoked}</p>
                          <p className="text-xs text-muted-foreground">Already revoked</p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-300">
                      Use this after issuing a refund or detecting abuse. You can restore access later using the Restore button.
                    </p>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-secondary text-foreground hover:bg-secondary/80">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => revokeDialog && revokeTokensMutation.mutate({ orderId: revokeDialog.orderId })}
                disabled={revokeTokensMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {revokeTokensMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldOff className="w-4 h-4 mr-2" />}
                Revoke Access
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Restore Access Confirmation Dialog ─────────────────────────── */}
        <AlertDialog open={!!restoreDialog} onOpenChange={(open) => !open && setRestoreDialog(null)}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-foreground">
                <ShieldCheck className="w-5 h-5 text-green-400" />
                Restore Download Access
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p className="text-muted-foreground">
                    This will restore all previously revoked download links for
                    order <strong className="text-primary">{restoreDialog?.orderRef}</strong>,
                    allowing the customer to use them again (subject to original expiry and download limits).
                  </p>
                  {tokenStatusQuery.data && (
                    <div className="bg-secondary rounded-lg p-3 border border-border text-sm">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-lg font-bold text-green-400">{tokenStatusQuery.data.active}</p>
                          <p className="text-xs text-muted-foreground">Active links</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-yellow-400">{tokenStatusQuery.data.expired}</p>
                          <p className="text-xs text-muted-foreground">Expired</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-red-400">{tokenStatusQuery.data.revoked}</p>
                          <p className="text-xs text-muted-foreground">Will be restored</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-secondary text-foreground hover:bg-secondary/80">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => restoreDialog && restoreTokensMutation.mutate({ orderId: restoreDialog.orderId })}
                disabled={restoreTokensMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {restoreTokensMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                Restore Access
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Chatbot Training Tab ─────────────────────────────────────────── */}
        {tab === "chatbot" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">AI Knowledge Base</h2>
                <p className="text-sm text-muted-foreground mt-1">Train the chatbot by adding Q&A pairs. The AI uses this to answer customer questions.</p>
              </div>
              <button
                onClick={() => setEditingKB({ ...EMPTY_KB })}
                className="btn-gold px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add Entry
              </button>
            </div>

            {/* KB Edit Form */}
            {editingKB && (
              <div className="bg-card border border-primary/30 rounded-xl p-5 mb-6 animate-in slide-in-from-top-4 duration-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground">{editingKB.id ? "Edit Entry" : "New Knowledge Entry"}</h3>
                  <button onClick={() => setEditingKB(null)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary"><X className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Category</label>
                    <select value={editingKB.category} onChange={(e) => setEditingKB((k) => k ? { ...k, category: e.target.value } : k)} className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50">
                      {["general", "payment", "shipping", "returns", "books", "account", "crypto", "security"].map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Priority (higher = more important)</label>
                    <input type="number" value={editingKB.priority} onChange={(e) => setEditingKB((k) => k ? { ...k, priority: Number(e.target.value) } : k)} className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground mb-1 block">Question</label>
                    <input value={editingKB.question} onChange={(e) => setEditingKB((k) => k ? { ...k, question: e.target.value } : k)} placeholder="e.g. What cryptocurrencies do you accept?" className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground mb-1 block">Answer</label>
                    <textarea value={editingKB.answer} onChange={(e) => setEditingKB((k) => k ? { ...k, answer: e.target.value } : k)} rows={4} placeholder="Provide a detailed, helpful answer..." className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 resize-none" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground mb-1 block">Keywords (comma-separated)</label>
                    <input value={editingKB.keywords || ""} onChange={(e) => setEditingKB((k) => k ? { ...k, keywords: e.target.value } : k)} placeholder="payment, crypto, bitcoin, ethereum" className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50" />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="active" checked={editingKB.active} onChange={(e) => setEditingKB((k) => k ? { ...k, active: e.target.checked } : k)} className="accent-primary" />
                    <label htmlFor="active" className="text-sm text-foreground cursor-pointer">Active (visible to chatbot)</label>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setEditingKB(null)} className="px-5 py-2 rounded-lg border border-border text-foreground hover:bg-secondary transition-colors text-sm">Cancel</button>
                  <button
                    onClick={() => upsertKB.mutate({ ...editingKB! })}
                    disabled={upsertKB.isPending || !editingKB.question || !editingKB.answer}
                    className="btn-gold flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {upsertKB.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Entry</>}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {knowledge?.map((entry) => (
                <div key={entry.id} className={cn("bg-card border rounded-xl p-4 transition-colors", entry.active ? "border-border" : "border-border/30 opacity-60")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded font-mono">{entry.category}</span>
                        {(entry.priority ?? 0) > 0 && <span className="text-xs text-primary">Priority: {entry.priority}</span>}
                        {!entry.active && <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">Inactive</span>}
                      </div>
                      <p className="font-semibold text-foreground text-sm mb-1">{entry.question}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{entry.answer}</p>
                      {entry.keywords && <p className="text-xs text-muted-foreground/60 mt-1">Keywords: {entry.keywords}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-none">
                      <button                       onClick={() => setEditingKB({ id: entry.id, category: entry.category ?? "general", question: entry.question, answer: entry.answer, keywords: entry.keywords || "", active: entry.active ?? true, priority: entry.priority ?? 0 })} className="p-1.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-secondary transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => { if (confirm("Delete this entry?")) deleteKB.mutate({ id: entry.id }); }} className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-secondary transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {(!knowledge || knowledge.length === 0) && (
                <div className="text-center py-16">
                  <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No knowledge base entries yet. Add some to train the chatbot!</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
