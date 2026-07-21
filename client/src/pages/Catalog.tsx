import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import BookCard from "@/components/BookCard";
import { cn } from "@/lib/utils";
import { Filter, Search, SlidersHorizontal, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";

const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "rating", label: "Top Rated" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
];

const GENRES = ["Technology", "Business", "Science", "Fiction", "Thriller"];
const PRICE_RANGES = [
  { label: "Under $15", min: 0, max: 15 },
  { label: "$15 – $25", min: 15, max: 25 },
  { label: "$25 – $40", min: 25, max: 40 },
  { label: "Over $40", min: 40, max: 999 },
];

export default function Catalog() {
  const { isAuthenticated } = useAuth();
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(search);

  const [searchQuery, setSearchQuery] = useState(params.get("search") || "");
  const [genre, setGenre] = useState(params.get("genre") || "");
  const [sort, setSort] = useState(params.get("sort") || "featured");
  const [priceRange, setPriceRange] = useState<{ min?: number; max?: number }>({});
  const [minRating, setMinRating] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, genre, sort, priceRange, minRating]);

  const { data, isLoading } = trpc.books.list.useQuery({
    search: debouncedSearch || undefined,
    genre: genre || undefined,
    sort,
    minPrice: priceRange.min,
    maxPrice: priceRange.max,
    minRating,
    page,
    limit: 12,
  });

  const { data: wishlistIds } = trpc.wishlist.getIds.useQuery(undefined, { enabled: isAuthenticated });

  const totalPages = data ? Math.ceil(data.total / 12) : 0;

  const clearFilters = () => {
    setSearchQuery("");
    setGenre("");
    setSort("featured");
    setPriceRange({});
    setMinRating(undefined);
    setPage(1);
  };

  const hasFilters = searchQuery || genre || sort !== "featured" || priceRange.min !== undefined || minRating;

  return (
    <div className="min-h-screen pt-20 page-enter">
      <div className="container py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              {genre ? `${genre} Books` : debouncedSearch ? `Results for "${debouncedSearch}"` : "All Books"}
            </h1>
            {data && (
              <p className="text-muted-foreground mt-1">{data.total.toLocaleString()} books found</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search books..."
                className="bg-card border border-border rounded-lg pl-9 pr-4 py-2 text-sm w-48 md:w-64 text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 cursor-pointer"
            >
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {/* Filter toggle */}
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors", filtersOpen ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground hover:border-primary/50")}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
            </button>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Sidebar Filters */}
          {filtersOpen && (
            <aside className="w-64 flex-none animate-in slide-in-from-left-4 duration-200">
              <div className="bg-card border border-border rounded-xl p-5 sticky top-24">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-semibold text-foreground">Filters</h3>
                  {hasFilters && (
                    <button onClick={clearFilters} className="text-xs text-primary hover:underline">Clear all</button>
                  )}
                </div>

                {/* Genre */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-foreground mb-3">Genre</h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="genre" checked={!genre} onChange={() => setGenre("")} className="accent-primary" />
                      <span className="text-sm text-foreground">All Genres</span>
                    </label>
                    {GENRES.map((g) => (
                      <label key={g} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="genre" checked={genre === g} onChange={() => setGenre(g)} className="accent-primary" />
                        <span className="text-sm text-foreground">{g}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-foreground mb-3">Price Range</h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="price" checked={!priceRange.min && !priceRange.max} onChange={() => setPriceRange({})} className="accent-primary" />
                      <span className="text-sm text-foreground">Any Price</span>
                    </label>
                    {PRICE_RANGES.map((r) => (
                      <label key={r.label} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="price" checked={priceRange.min === r.min && priceRange.max === r.max} onChange={() => setPriceRange({ min: r.min, max: r.max })} className="accent-primary" />
                        <span className="text-sm text-foreground">{r.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Rating */}
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-3">Min Rating</h4>
                  <div className="space-y-2">
                    {[undefined, 3, 4, 4.5].map((r) => (
                      <label key={String(r)} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="rating" checked={minRating === r} onChange={() => setMinRating(r)} className="accent-primary" />
                        <span className="text-sm text-foreground">{r ? `${r}+ stars` : "Any Rating"}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </aside>
          )}

          {/* Book Grid */}
          <div className="flex-1 min-w-0">
            {/* Active filters */}
            {hasFilters && (
              <div className="flex flex-wrap gap-2 mb-4">
                {genre && <span className="genre-badge flex items-center gap-1">{genre} <button onClick={() => setGenre("")}><X className="w-3 h-3" /></button></span>}
                {debouncedSearch && <span className="genre-badge flex items-center gap-1">"{debouncedSearch}" <button onClick={() => setSearchQuery("")}><X className="w-3 h-3" /></button></span>}
                {(priceRange.min !== undefined) && <span className="genre-badge flex items-center gap-1">{PRICE_RANGES.find(r => r.min === priceRange.min)?.label} <button onClick={() => setPriceRange({})}><X className="w-3 h-3" /></button></span>}
                {minRating && <span className="genre-badge flex items-center gap-1">{minRating}+ stars <button onClick={() => setMinRating(undefined)}><X className="w-3 h-3" /></button></span>}
              </div>
            )}

            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(12)].map((_, i) => <div key={i} className="h-80 skeleton rounded-xl" />)}
              </div>
            ) : data?.books.length === 0 ? (
              <div className="text-center py-20">
                <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-display text-xl font-bold text-foreground mb-2">No books found</h3>
                <p className="text-muted-foreground mb-4">Try adjusting your filters or search terms</p>
                <button onClick={clearFilters} className="btn-gold px-6 py-2 rounded-lg text-sm font-semibold">Clear Filters</button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {data?.books.map((book) => (
                    <BookCard key={book.id} book={book} wishlisted={wishlistIds?.includes(book.id)} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-10">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-foreground hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {[...Array(Math.min(totalPages, 7))].map((_, i) => {
                      const p = i + 1;
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={cn("w-9 h-9 rounded-lg text-sm font-medium transition-colors", page === p ? "bg-primary text-primary-foreground" : "border border-border text-foreground hover:border-primary/50")}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-foreground hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
