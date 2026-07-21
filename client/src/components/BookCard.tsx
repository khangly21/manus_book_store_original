import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { cn, formatPrice } from "@/lib/utils";
import { Heart, ShoppingCart, Star } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useCartDrawer } from "@/contexts/CartContext";

interface BookCardProps {
  book: {
    id: number;
    title: string;
    author: string;
    price: string;
    originalPrice?: string | null;
    coverUrl?: string | null;
    genre: string;
    rating?: string | null;
    reviewCount?: number | null;
    featured?: boolean | null;
    bestseller?: boolean | null;
  };
  wishlisted?: boolean;
  compact?: boolean;
}

export default function BookCard({ book, wishlisted: initialWishlisted = false, compact = false }: BookCardProps) {
  const { isAuthenticated } = useAuth();
  const { openCart } = useCartDrawer();
  const [wishlisted, setWishlisted] = useState(initialWishlisted);
  const [addingToCart, setAddingToCart] = useState(false);
  const utils = trpc.useUtils();

  const addToCart = trpc.cart.add.useMutation({
    onSuccess: () => {
      utils.cart.get.invalidate();
      toast.success(`"${book.title}" added to cart`, { duration: 2000 });
      setAddingToCart(false);
    },
    onError: () => {
      toast.error("Failed to add to cart");
      setAddingToCart(false);
    },
  });

  const toggleWishlist = trpc.wishlist.toggle.useMutation({
    onSuccess: (data) => {
      setWishlisted(data.added);
      utils.wishlist.getIds.invalidate();
      toast.success(data.added ? "Added to wishlist" : "Removed from wishlist", { duration: 1500 });
    },
  });

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error("Please sign in to add to cart");
      return;
    }
    setAddingToCart(true);
    addToCart.mutate({ bookId: book.id, quantity: 1 });
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error("Please sign in to use wishlist");
      return;
    }
    toggleWishlist.mutate({ bookId: book.id });
  };

  const rating = Number(book.rating ?? 0);
  const stars = Math.round(rating);

  return (
    <Link href={`/book/${book.id}`} className="block group">
      <div className={cn("book-card bg-card rounded-xl overflow-hidden border border-border/50 h-full flex flex-col", compact ? "max-w-[180px]" : "")}>
        {/* Cover */}
        <div className={cn("relative overflow-hidden book-cover-shine bg-navy-light", compact ? "aspect-[2/3]" : "aspect-[3/4]")}>
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt={book.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-navy-light to-navy">
              <span className="text-4xl font-display text-primary/30">{book.title[0]}</span>
            </div>
          )}
          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {book.bestseller && (
              <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-md shadow">Bestseller</span>
            )}
            {book.featured && !book.bestseller && (
              <span className="bg-blue-500/90 text-white text-xs font-bold px-2 py-0.5 rounded-md shadow">Featured</span>
            )}
            {book.originalPrice && Number(book.originalPrice) > Number(book.price) && (
              <span className="bg-red-500/90 text-white text-xs font-bold px-2 py-0.5 rounded-md shadow">
                -{Math.round((1 - Number(book.price) / Number(book.originalPrice)) * 100)}%
              </span>
            )}
          </div>
          {/* Wishlist button */}
          <button
            onClick={handleWishlist}
            className={cn(
              "absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200",
              "opacity-0 group-hover:opacity-100",
              wishlisted ? "bg-red-500/90 text-white opacity-100" : "bg-black/50 text-white hover:bg-red-500/80"
            )}
          >
            <Heart className={cn("w-4 h-4", wishlisted ? "fill-current" : "")} />
          </button>
        </div>

        {/* Info */}
        <div className={cn("flex flex-col flex-1 p-3", compact ? "p-2" : "p-4")}>
          <span className="genre-badge self-start mb-2">{book.genre}</span>
          <h3 className={cn("font-display font-semibold text-foreground line-clamp-2 mb-1 group-hover:text-primary transition-colors", compact ? "text-sm" : "text-base")}>
            {book.title}
          </h3>
          <p className={cn("text-muted-foreground mb-2", compact ? "text-xs" : "text-sm")}>{book.author}</p>

          {/* Rating */}
          {!compact && (
            <div className="flex items-center gap-1.5 mb-3">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={cn("w-3.5 h-3.5", s <= stars ? "star-filled fill-current" : "star-empty")} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">({book.reviewCount?.toLocaleString() ?? 0})</span>
            </div>
          )}

          {/* Price + Cart */}
          <div className="flex items-center justify-between mt-auto">
            <div>
              <span className="price-current text-lg">{formatPrice(book.price)}</span>
              {book.originalPrice && Number(book.originalPrice) > Number(book.price) && (
                <span className="price-original ml-1.5">{formatPrice(book.originalPrice)}</span>
              )}
            </div>
            {!compact && (
              <button
                onClick={handleAddToCart}
                disabled={addingToCart}
                className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200",
                  "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground",
                  "border border-primary/30 hover:border-primary",
                  addingToCart && "opacity-50 cursor-not-allowed"
                )}
              >
                <ShoppingCart className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
