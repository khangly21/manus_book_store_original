import { trpc } from "@/lib/trpc";
import { cn, formatPrice } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import BookCard from "@/components/BookCard";
import { Link } from "wouter";
import { ArrowRight, BookOpen, Shield, Zap, Star, ChevronRight, TrendingUp, Cpu, Briefcase, FlaskConical, BookMarked, Sword } from "lucide-react";
import { useRef } from "react";

const GENRE_ICONS: Record<string, React.ReactNode> = {
  Technology: <Cpu className="w-5 h-5" />,
  Business: <Briefcase className="w-5 h-5" />,
  Science: <FlaskConical className="w-5 h-5" />,
  Fiction: <BookMarked className="w-5 h-5" />,
  Thriller: <Sword className="w-5 h-5" />,
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={cn("w-4 h-4", s <= Math.round(rating) ? "text-primary fill-current" : "text-border")} />
      ))}
    </div>
  );
}

function CategoryCarousel({ genre }: { genre: string }) {
  const { data: books, isLoading } = trpc.books.byGenre.useQuery({ genre, limit: 8 });
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === "right" ? 300 : -300, behavior: "smooth" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex-none w-44 h-72 skeleton rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="relative group">
      <button
        onClick={() => scroll("left")}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-8 h-8 bg-card border border-border rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:border-primary/50"
      >
        <ChevronRight className="w-4 h-4 rotate-180" />
      </button>
      <div ref={scrollRef} className="carousel-scroll flex gap-4 pb-2">
        {books?.map((book) => (
          <div key={book.id} className="flex-none w-44">
            <BookCard book={book} compact />
          </div>
        ))}
      </div>
      <button
        onClick={() => scroll("right")}
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-8 h-8 bg-card border border-border rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:border-primary/50"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { data: featured, isLoading: featuredLoading } = trpc.books.featured.useQuery();
  const { data: bestsellers, isLoading: bestsellersLoading } = trpc.books.bestsellers.useQuery();
  const { data: wishlistIds } = trpc.wishlist.getIds.useQuery(undefined, { enabled: isAuthenticated });

  const heroBook = featured?.[0];
  const genres = ["Technology", "Business", "Science", "Fiction", "Thriller"];

  return (
    <div className="min-h-screen page-enter">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[90vh] flex items-center hero-gradient overflow-hidden pt-16">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 right-10 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute bottom-20 left-10 w-64 h-64 rounded-full bg-blue-500/5 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-primary/5" />
        </div>

        <div className="container relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center py-20">
            {/* Left: Text */}
            <div>
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-sm text-primary font-medium mb-6">
                <Zap className="w-3.5 h-3.5" />
                Pay with Crypto · Verified by Cryptography
              </div>
              <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
                <span className="text-foreground">The World's</span>
                <br />
                <span className="text-gold-gradient">Most Trusted</span>
                <br />
                <span className="text-foreground">Bookstore</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-8 max-w-lg leading-relaxed">
                Every book verified with RSA cryptography and SHA-256 hashing. Pay securely with Bitcoin, Ethereum, or Litecoin. Your library, secured by the blockchain.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/catalog" className="btn-gold px-8 py-3.5 rounded-xl text-base font-bold flex items-center gap-2">
                  Browse Books <ArrowRight className="w-5 h-5" />
                </Link>
                {!isAuthenticated && (
                  <a href={getLoginUrl()} className="px-8 py-3.5 rounded-xl text-base font-semibold border border-border text-foreground hover:border-primary/50 hover:bg-secondary transition-all flex items-center gap-2">
                    Sign In Free
                  </a>
                )}
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap gap-6 mt-10">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="w-4 h-4 text-green-400" />
                  <span>RSA Verified Books</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Zap className="w-4 h-4 text-primary" />
                  <span>Crypto Payments</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BookOpen className="w-4 h-4 text-blue-400" />
                  <span>20,000+ Titles</span>
                </div>
              </div>
            </div>

            {/* Right: Featured book showcase */}
            <div className="relative hidden lg:block">
              <div className="relative flex items-end justify-center gap-4">
                {featured?.slice(0, 3).map((book, i) => (
                  <Link
                    key={book.id}
                    href={`/book/${book.id}`}
                    className={cn(
                      "relative rounded-2xl overflow-hidden shadow-2xl transition-all duration-500 hover:-translate-y-3 cursor-pointer",
                      i === 1 ? "w-52 h-80 z-10 -translate-y-8" : "w-40 h-64 z-0 opacity-80"
                    )}
                  >
                    {book.coverUrl ? (
                      <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-navy-light to-navy flex items-center justify-center">
                        <BookOpen className="w-12 h-12 text-primary/30" />
                      </div>
                    )}
                    {i === 1 && (
                      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                        <p className="text-white font-display font-bold text-sm line-clamp-1">{book.title}</p>
                        <p className="text-primary text-xs font-semibold">{formatPrice(book.price)}</p>
                      </div>
                    )}
                  </Link>
                ))}
                {/* Floating rating card */}
                {heroBook && (
                  <div className="absolute -bottom-6 -left-6 glass-card rounded-xl p-3 shadow-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex-none">
                        <img src={heroBook.coverUrl || ""} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground line-clamp-1">{heroBook.title}</p>
                        <StarRating rating={Number(heroBook.rating)} />
                        <p className="text-xs text-muted-foreground">{heroBook.reviewCount?.toLocaleString()} reviews</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ─────────────────────────────────────────────────────── */}
      <section className="bg-card border-y border-border py-6">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: "20,000+", label: "Books Available" },
              { value: "500K+", label: "Happy Readers" },
              { value: "3 Cryptos", label: "Payment Options" },
              { value: "100%", label: "Verified Authentic" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-display font-bold text-primary">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bestsellers ───────────────────────────────────────────────────── */}
      <section className="py-16">
        <div className="container">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <span className="text-primary text-sm font-semibold uppercase tracking-wider">Trending Now</span>
              </div>
              <h2 className="section-heading">Bestselling Books</h2>
            </div>
            <Link href="/catalog?sort=rating" className="flex items-center gap-1 text-primary text-sm font-medium hover:gap-2 transition-all">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {bestsellersLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => <div key={i} className="h-80 skeleton rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {bestsellers?.slice(0, 5).map((book) => (
                <BookCard key={book.id} book={book} wishlisted={wishlistIds?.includes(book.id)} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Category Carousels ────────────────────────────────────────────── */}
      {genres.map((genre) => (
        <section key={genre} className="py-10 border-t border-border/50">
          <div className="container">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-primary">
                  {GENRE_ICONS[genre]}
                </div>
                <h2 className="text-xl font-display font-bold text-foreground">{genre}</h2>
              </div>
              <Link href={`/catalog?genre=${genre}`} className="flex items-center gap-1 text-primary text-sm font-medium hover:gap-2 transition-all">
                See All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <CategoryCarousel genre={genre} />
          </div>
        </section>
      ))}

      {/* ── Features Banner ───────────────────────────────────────────────── */}
      <section className="py-20 bg-card border-t border-border">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="section-heading mb-4">Why CryptoBook Store?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">The only bookstore that combines premium content with cutting-edge cryptographic verification and blockchain payments.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Shield className="w-8 h-8 text-green-400" />,
                title: "Cryptographic Integrity",
                desc: "Every book carries an RSA public key and SHA-256 hash. Verify authenticity directly from the author's digital signature — no forgeries, ever.",
              },
              {
                icon: <Zap className="w-8 h-8 text-primary" />,
                title: "Crypto Payments",
                desc: "Pay with Bitcoin, Ethereum, or Litecoin. Real-time exchange rates, transaction hash tracking, and blockchain confirmation in minutes.",
              },
              {
                icon: <BookOpen className="w-8 h-8 text-blue-400" />,
                title: "AI Book Assistant",
                desc: "Our AI chatbot knows everything about our catalog, payment methods, and policies. Get instant answers 24/7 from a knowledge base trained by our team.",
              },
            ].map((feature) => (
              <div key={feature.title} className="glass-card rounded-2xl p-8 text-center hover:border-primary/30 transition-colors">
                <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-5">
                  {feature.icon}
                </div>
                <h3 className="font-display text-xl font-bold text-foreground mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-12 bg-background">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-navy" />
                </div>
                <span className="font-display font-bold text-foreground">CryptoBook</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">The world's most trusted bookstore, powered by cryptography and blockchain technology.</p>
            </div>
            {[
              { title: "Browse", links: ["All Books", "Technology", "Business", "Science", "Fiction", "Thriller"] },
              { title: "Account", links: ["Sign In", "My Orders", "Wishlist", "Profile"] },
              { title: "Support", links: ["Help Center", "Shipping Info", "Returns", "Contact Us"] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="font-semibold text-foreground mb-4">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link}>
                      <span className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{link}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">© 2024 CryptoBook Store. All rights reserved.</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Privacy Policy</span>
              <span>Terms of Service</span>
              <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-green-400" /> SSL Secured</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
