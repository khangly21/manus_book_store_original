import { trpc } from "@/lib/trpc";
import { cn, formatPrice } from "@/lib/utils";
import { useCartDrawer } from "@/contexts/CartContext";
import { X, ShoppingCart, Trash2, Plus, Minus, ArrowRight, BookOpen } from "lucide-react";
import { Link } from "wouter";

export default function CartDrawer() {
  const { isOpen, closeCart } = useCartDrawer();
  const utils = trpc.useUtils();

  const { data: cartItems, isLoading } = trpc.cart.get.useQuery(undefined, { enabled: isOpen });

  const updateItem = trpc.cart.update.useMutation({
    onSuccess: () => utils.cart.get.invalidate(),
  });
  const removeItem = trpc.cart.remove.useMutation({
    onSuccess: () => utils.cart.get.invalidate(),
  });

  const subtotal = cartItems?.reduce((sum, item) => sum + Number(item.book?.price ?? 0) * item.quantity, 0) ?? 0;
  const itemCount = cartItems?.reduce((s, i) => s + i.quantity, 0) ?? 0;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200"
          onClick={closeCart}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-md bg-card border-l border-border z-50 flex flex-col shadow-2xl",
          "transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-5 h-5 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">Your Cart</h2>
            {itemCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">{itemCount}</span>
            )}
          </div>
          <button onClick={closeCart} className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => <div key={i} className="h-20 skeleton rounded-xl" />)}
            </div>
          ) : cartItems?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-4">
                <ShoppingCart className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="font-display text-lg font-bold text-foreground mb-2">Your cart is empty</h3>
              <p className="text-muted-foreground text-sm mb-6">Add some books to get started!</p>
              <Link href="/catalog" onClick={closeCart} className="btn-gold px-6 py-2.5 rounded-xl text-sm font-bold">
                Browse Books
              </Link>
            </div>
          ) : (
            cartItems?.map((item) => (
              <div key={item.id} className="flex gap-3 bg-secondary rounded-xl p-3">
                {/* Cover */}
                <Link href={`/book/${item.bookId}`} onClick={closeCart} className="flex-none w-16 h-20 rounded-lg overflow-hidden bg-navy-light">
                  {item.book?.coverUrl ? (
                    <img src={item.book.coverUrl} alt={item.book.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-primary/30" />
                    </div>
                  )}
                </Link>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <Link href={`/book/${item.bookId}`} onClick={closeCart}>
                    <h4 className="text-sm font-semibold text-foreground line-clamp-2 hover:text-primary transition-colors">{item.book?.title}</h4>
                  </Link>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.book?.author}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-primary font-bold">{formatPrice(item.book?.price ?? 0)}</span>
                    {/* Quantity controls */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateItem.mutate({ id: item.id, quantity: item.quantity - 1 })}
                        className="w-6 h-6 rounded flex items-center justify-center bg-card text-muted-foreground hover:text-foreground hover:bg-border transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-medium text-foreground">{item.quantity}</span>
                      <button
                        onClick={() => updateItem.mutate({ id: item.id, quantity: item.quantity + 1 })}
                        className="w-6 h-6 rounded flex items-center justify-center bg-card text-muted-foreground hover:text-foreground hover:bg-border transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
                {/* Remove */}
                <button
                  onClick={() => removeItem.mutate({ id: item.id })}
                  className="flex-none p-1.5 text-muted-foreground hover:text-destructive transition-colors self-start"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {(cartItems?.length ?? 0) > 0 && (
          <div className="p-5 border-t border-border space-y-4">
            {/* Order Summary */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal ({itemCount} items)</span>
                <span className="text-foreground font-medium">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shipping</span>
                <span className="text-green-400 font-medium">Free</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="font-bold text-foreground">Total</span>
                <span className="font-bold text-primary text-lg">{formatPrice(subtotal)}</span>
              </div>
            </div>

            <Link
              href="/checkout"
              onClick={closeCart}
              className="btn-gold w-full py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2"
            >
              Proceed to Checkout <ArrowRight className="w-5 h-5" />
            </Link>
            <button onClick={closeCart} className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </>
  );
}
