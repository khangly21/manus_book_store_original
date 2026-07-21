import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn, formatPrice, truncateHash, formatDate } from "@/lib/utils";
import { getLoginUrl } from "@/const";
import IntegrityBadge from "@/components/IntegrityBadge";
import { ArrowLeft, Heart, ShoppingCart, Star, User, BookOpen, Calendar, Globe, Hash, ChevronDown, ChevronUp, Download, Loader2, Lock, FileText, Eye } from "lucide-react";
import BookPreviewReader from "@/components/BookPreviewReader";
import { useState } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";
import { useCartDrawer } from "@/contexts/CartContext";

function StarRating({ rating, size = "md" }: { rating: number; size?: "sm" | "md" | "lg" }) {
  const sz = size === "lg" ? "w-5 h-5" : size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={cn(sz, s <= Math.round(rating) ? "text-primary fill-current" : "text-border")} />
      ))}
    </div>
  );
}

export default function BookDetail() {
  const { id } = useParams<{ id: string }>();
  const bookId = Number(id);
  const { isAuthenticated, user } = useAuth();
  const { openCart } = useCartDrawer();
  const [quantity, setQuantity] = useState(1);
  const [wishlisted, setWishlisted] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: "", body: "" });
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const utils = trpc.useUtils();

  const { data: book, isLoading } = trpc.books.getById.useQuery({ id: bookId });
  const { data: reviews } = trpc.reviews.getByBook.useQuery({ bookId });
  const { data: wishlistIds } = trpc.wishlist.getIds.useQuery(undefined, { enabled: isAuthenticated });

  const addToCart = trpc.cart.add.useMutation({
    onSuccess: () => {
      utils.cart.get.invalidate();
      toast.success("Added to cart!");
      openCart();
    },
  });

  const toggleWishlist = trpc.wishlist.toggle.useMutation({
    onSuccess: (data) => {
      utils.wishlist.getIds.invalidate();
      toast.success(data.added ? "Added to wishlist" : "Removed from wishlist");
    },
  });

  const addReview = trpc.reviews.add.useMutation({
    onSuccess: () => {
      utils.reviews.getByBook.invalidate({ bookId });
      utils.books.getById.invalidate({ id: bookId });
      setShowReviewForm(false);
      setReviewForm({ rating: 5, title: "", body: "" });
      toast.success("Review submitted!");
    },
  });

  const isWishlisted = wishlistIds?.includes(bookId) ?? false;

  // Check if user has purchased this book (for download gating)
  const { data: purchaseStatus } = trpc.books.checkPurchased.useQuery(
    { bookId },
    { enabled: isAuthenticated }
  );

  const downloadMutation = trpc.books.download.useMutation({
    onSuccess: (data) => {
      // Trigger browser download via a temporary anchor
      const a = document.createElement("a");
      a.href = data.url;
      a.download = data.fileName || "book.pdf";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Download started!", {
        description: data.fileHash ? `SHA-256: ${data.fileHash.slice(0, 16)}…` : undefined,
      });
    },
    onError: (err) => toast.error("Download failed", { description: err.message }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen pt-20">
        <div className="container py-8">
          <div className="grid lg:grid-cols-5 gap-10">
            <div className="lg:col-span-2 h-[500px] skeleton rounded-2xl" />
            <div className="lg:col-span-3 space-y-4">
              {[...Array(6)].map((_, i) => <div key={i} className={cn("skeleton rounded-lg", i === 0 ? "h-10 w-3/4" : "h-5")} />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-display text-2xl font-bold text-foreground mb-2">Book Not Found</h2>
          <Link href="/catalog" className="text-primary hover:underline">Browse all books</Link>
        </div>
      </div>
    );
  }

  const rating = Number(book.rating ?? 0);
  const desc = book.description || "";
  const isLongDesc = desc.length > 400;

  return (
    <div className="min-h-screen pt-20 page-enter">
      <div className="container py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <span>/</span>
          <Link href="/catalog" className="hover:text-foreground transition-colors">Books</Link>
          <span>/</span>
          <Link href={`/catalog?genre=${book.genre}`} className="hover:text-foreground transition-colors">{book.genre}</Link>
          <span>/</span>
          <span className="text-foreground line-clamp-1">{book.title}</span>
        </div>

        <div className="grid lg:grid-cols-5 gap-10">
          {/* Left: Cover */}
          <div className="lg:col-span-2">
            <div className="sticky top-24">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl book-cover-shine aspect-[3/4] max-w-sm mx-auto">
                {book.coverUrl ? (
                  <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-navy-light to-navy flex items-center justify-center">
                    <BookOpen className="w-20 h-20 text-primary/30" />
                  </div>
                )}
                {book.bestseller && (
                  <div className="absolute top-4 left-4 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">Bestseller</div>
                )}
              </div>

              {/* Integrity Badge */}
              {book.contentHash && book.rsaPublicKey && (
                <div className="mt-6">
                  <IntegrityBadge book={book} />
                </div>
              )}
            </div>
          </div>

          {/* Right: Info */}
          <div className="lg:col-span-3">
            <span className="genre-badge mb-3 inline-block">{book.genre}</span>
            <h1 className="font-display text-4xl font-bold text-foreground mb-2">{book.title}</h1>
            <p className="text-xl text-muted-foreground mb-4">by <span className="text-foreground font-medium">{book.author}</span></p>

            {/* Rating */}
            <div className="flex items-center gap-3 mb-6">
              <StarRating rating={rating} size="lg" />
              <span className="text-primary font-bold text-lg">{rating.toFixed(1)}</span>
              <span className="text-muted-foreground text-sm">({book.reviewCount?.toLocaleString() ?? 0} reviews)</span>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-4xl font-bold text-primary">{formatPrice(book.price)}</span>
              {book.originalPrice && Number(book.originalPrice) > Number(book.price) && (
                <>
                  <span className="price-original text-xl">{formatPrice(book.originalPrice)}</span>
                  <span className="bg-red-500/20 text-red-400 text-sm font-bold px-2 py-0.5 rounded">
                    Save {Math.round((1 - Number(book.price) / Number(book.originalPrice)) * 100)}%
                  </span>
                </>
              )}
            </div>

            {/* Read Sample button — shown when file is available (no purchase required) */}
            {book.fileName && book.fileMimeType !== "application/epub+zip" && (
              <div className="mb-3">
                <button
                  onClick={() => setShowPreview(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all font-semibold text-sm"
                >
                  <Eye className="w-4 h-4" />
                  Read Free Sample (First 10 Pages)
                </button>
              </div>
            )}

            {/* Download button — shown when file is available */}
            {book.fileName && (
              <div className="mb-5">
                {isAuthenticated && purchaseStatus?.purchased ? (
                  <button
                    onClick={() => downloadMutation.mutate({ bookId: book.id })}
                    disabled={downloadMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-green-600/20 border border-green-500/40 text-green-400 hover:bg-green-600/30 transition-all font-semibold text-sm"
                  >
                    {downloadMutation.isPending
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Preparing download...</>
                      : <><Download className="w-4 h-4" /> Download {book.fileMimeType === "application/epub+zip" ? "ePub" : "PDF"} — {book.fileName}</>
                    }
                  </button>
                ) : isAuthenticated ? (
                  <div className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-secondary border border-dashed border-border text-muted-foreground text-sm">
                    <Lock className="w-4 h-4" />
                    <span>Purchase to unlock digital download</span>
                    <FileText className="w-4 h-4 ml-1 text-primary/60" />
                  </div>
                ) : (
                  <div className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-secondary border border-dashed border-border text-muted-foreground text-sm">
                    <Lock className="w-4 h-4" />
                    <span>Sign in and purchase to download</span>
                  </div>
                )}
              </div>
            )}

            {/* Add to Cart */}
            <div className="flex gap-3 mb-8">
              <div className="flex items-center border border-border rounded-lg overflow-hidden">
                <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="px-3 py-3 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">−</button>
                <span className="px-4 py-3 text-foreground font-medium min-w-[3rem] text-center">{quantity}</span>
                <button onClick={() => setQuantity((q) => q + 1)} className="px-3 py-3 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">+</button>
              </div>
              {isAuthenticated ? (
                <button
                  onClick={() => addToCart.mutate({ bookId: book.id, quantity })}
                  disabled={addToCart.isPending}
                  className="btn-gold flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-base"
                >
                  <ShoppingCart className="w-5 h-5" />
                  {addToCart.isPending ? "Adding..." : "Add to Cart"}
                </button>
              ) : (
                <a href={getLoginUrl()} className="btn-gold flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-base">
                  Sign In to Buy
                </a>
              )}
              <button
                onClick={() => isAuthenticated ? toggleWishlist.mutate({ bookId: book.id }) : toast.error("Sign in to use wishlist")}
                className={cn("w-12 h-12 rounded-xl border flex items-center justify-center transition-all", isWishlisted ? "bg-red-500/20 border-red-500/40 text-red-400" : "border-border text-muted-foreground hover:border-red-500/40 hover:text-red-400")}
              >
                <Heart className={cn("w-5 h-5", isWishlisted ? "fill-current" : "")} />
              </button>
            </div>

            {/* Book Meta */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              {[
                { icon: <Hash className="w-4 h-4" />, label: "ISBN", value: book.isbn },
                { icon: <BookOpen className="w-4 h-4" />, label: "Pages", value: book.pages?.toLocaleString() },
                { icon: <Calendar className="w-4 h-4" />, label: "Published", value: book.publishedYear },
                { icon: <Globe className="w-4 h-4" />, label: "Language", value: book.language },
              ].filter((m) => m.value).map((meta) => (
                <div key={meta.label} className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
                  <span className="text-muted-foreground">{meta.icon}</span>
                  <span className="text-xs text-muted-foreground">{meta.label}:</span>
                  <span className="text-sm text-foreground font-medium">{meta.value}</span>
                </div>
              ))}
            </div>

            {/* Description */}
            <div className="mb-8">
              <h3 className="font-display text-xl font-bold text-foreground mb-3">About This Book</h3>
              <p className={cn("text-muted-foreground leading-relaxed", !showFullDesc && isLongDesc ? "line-clamp-4" : "")}>
                {desc}
              </p>
              {isLongDesc && (
                <button onClick={() => setShowFullDesc((v) => !v)} className="flex items-center gap-1 text-primary text-sm mt-2 hover:underline">
                  {showFullDesc ? <><ChevronUp className="w-4 h-4" /> Show less</> : <><ChevronDown className="w-4 h-4" /> Read more</>}
                </button>
              )}
            </div>

            {/* Author Bio */}
            {book.authorBio && (
              <div className="bg-card border border-border rounded-xl p-5 mb-8">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{book.author}</p>
                    <p className="text-xs text-muted-foreground">Author</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{book.authorBio}</p>
              </div>
            )}
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mt-16 border-t border-border pt-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-display text-2xl font-bold text-foreground">
              Customer Reviews
              <span className="text-muted-foreground font-normal text-lg ml-2">({reviews?.length ?? 0})</span>
            </h2>
            {isAuthenticated && (
              <button
                onClick={() => setShowReviewForm((v) => !v)}
                className="btn-gold px-5 py-2 rounded-lg text-sm font-semibold"
              >
                Write a Review
              </button>
            )}
          </div>

          {/* Review Form */}
          {showReviewForm && (
            <div className="bg-card border border-border rounded-xl p-6 mb-8 animate-in slide-in-from-top-4 duration-200">
              <h3 className="font-semibold text-foreground mb-4">Your Review</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Rating</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button key={s} onClick={() => setReviewForm((f) => ({ ...f, rating: s }))}>
                        <Star className={cn("w-7 h-7 transition-colors", s <= reviewForm.rating ? "text-primary fill-current" : "text-border hover:text-primary/50")} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Review Title</label>
                  <input
                    value={reviewForm.title}
                    onChange={(e) => setReviewForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Summarize your review"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Your Review</label>
                  <textarea
                    value={reviewForm.body}
                    onChange={(e) => setReviewForm((f) => ({ ...f, body: e.target.value }))}
                    placeholder="What did you think of this book?"
                    rows={4}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 resize-none"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => addReview.mutate({ bookId: book.id, ...reviewForm })}
                    disabled={addReview.isPending || !reviewForm.title || !reviewForm.body}
                    className="btn-gold px-6 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                  >
                    {addReview.isPending ? "Submitting..." : "Submit Review"}
                  </button>
                  <button onClick={() => setShowReviewForm(false)} className="px-6 py-2 rounded-lg text-sm border border-border text-foreground hover:bg-secondary transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reviews List */}
          <div className="space-y-4">
            {reviews?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No reviews yet. Be the first to review this book!</p>
              </div>
            ) : (
              reviews?.map((review) => (
                <div key={review.id} className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                        {review.userName?.[0]?.toUpperCase() || "U"}
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">{review.userName || "Anonymous"}</p>
                        <div className="flex items-center gap-2">
                          <StarRating rating={review.rating} size="sm" />
                          {review.verified && <span className="text-xs text-green-400 font-medium">✓ Verified</span>}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</span>
                  </div>
                  {review.title && <p className="font-semibold text-foreground mb-1">{review.title}</p>}
                  <p className="text-sm text-muted-foreground leading-relaxed">{review.body}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Book Preview Reader Modal */}
      {book && showPreview && (
        <BookPreviewReader
          bookId={book.id}
          bookTitle={book.title}
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          onBuyNow={() => {
            setShowPreview(false);
            // Scroll to the Add to Cart button
            window.scrollTo({ top: 400, behavior: "smooth" });
          }}
        />
      )}
    </div>
  );
}
