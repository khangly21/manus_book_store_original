import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { getLoginUrl } from "@/const";
import {
  BookOpen,
  Heart,
  LogOut,
  Menu,
  Package,
  Search,
  Settings,
  ShoppingCart,
  User,
  X,
  Shield,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useCartDrawer } from "@/contexts/CartContext";

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { openCart } = useCartDrawer();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const cartQuery = trpc.cart.get.useQuery(undefined, { enabled: isAuthenticated });
  const cartCount = cartQuery.data?.reduce((s, i) => s + i.quantity, 0) ?? 0;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/catalog?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery("");
    }
  };

  const genres = ["Technology", "Business", "Science", "Fiction", "Thriller"];

  return (
    <nav className={cn("fixed top-0 left-0 right-0 z-50 transition-all duration-300", scrolled ? "navbar-blur shadow-lg" : "bg-transparent")}>
      <div className="container">
        <div className="flex items-center justify-between h-16 md:h-18">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg group-hover:shadow-yellow-500/30 transition-shadow">
              <BookOpen className="w-5 h-5 text-navy" />
            </div>
            <span className="font-display font-bold text-xl hidden sm:block">
              <span className="text-gold-gradient">CryptoBook</span>
              <span className="text-foreground/60 font-normal text-sm ml-1">Store</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            <Link href="/catalog" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary">
              All Books
            </Link>
            {genres.map((genre) => (
              <Link key={genre} href={`/catalog?genre=${genre}`} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary">
                {genre}
              </Link>
            ))}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Search */}
            {searchOpen ? (
              <form onSubmit={handleSearch} className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-200">
                <input
                  ref={searchRef}
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search books, authors..."
                  className="bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm w-48 md:w-64 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40 outline-none"
                />
                <button type="button" onClick={() => setSearchOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <button onClick={() => setSearchOpen(true)} className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary">
                <Search className="w-5 h-5" />
              </button>
            )}

            {/* Cart */}
            {isAuthenticated && (
              <button onClick={openCart} className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary">
                <ShoppingCart className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </button>
            )}

            {/* User Menu */}
            {isAuthenticated ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-secondary transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400/80 to-yellow-600/80 flex items-center justify-center text-navy font-bold text-sm">
                    {user?.name?.[0]?.toUpperCase() || "U"}
                  </div>
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 z-50">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-semibold text-foreground truncate">{user?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                      {user?.role === "admin" && (
                        <span className="inline-flex items-center gap-1 mt-1 text-xs text-primary font-medium">
                          <Shield className="w-3 h-3" /> Admin
                        </span>
                      )}
                    </div>
                    <div className="py-1">
                      <Link href="/profile" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors">
                        <User className="w-4 h-4 text-muted-foreground" /> Profile
                      </Link>
                      <Link href="/profile" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors">
                        <Package className="w-4 h-4 text-muted-foreground" /> My Orders
                      </Link>
                      <Link href="/profile" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors">
                        <Heart className="w-4 h-4 text-muted-foreground" /> Wishlist
                      </Link>
                      {user?.role === "admin" && (
                        <Link href="/admin" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-primary hover:bg-secondary transition-colors">
                          <Settings className="w-4 h-4" /> Admin Dashboard
                        </Link>
                      )}
                      <div className="border-t border-border mt-1">
                        <button onClick={() => { logout(); setUserMenuOpen(false); }} className="flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-secondary transition-colors w-full text-left">
                          <LogOut className="w-4 h-4" /> Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <a href={getLoginUrl()} className="btn-gold px-4 py-2 rounded-lg text-sm font-semibold transition-all">
                Sign In
              </a>
            )}

            {/* Mobile menu toggle */}
            <button onClick={() => setMenuOpen((v) => !v)} className="md:hidden p-2 text-muted-foreground hover:text-foreground">
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-border py-3 animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col gap-1">
              <Link href="/catalog" onClick={() => setMenuOpen(false)} className="px-4 py-2.5 text-sm text-foreground hover:bg-secondary rounded-md">All Books</Link>
              {genres.map((genre) => (
                <Link key={genre} href={`/catalog?genre=${genre}`} onClick={() => setMenuOpen(false)} className="px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary rounded-md">
                  {genre}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
