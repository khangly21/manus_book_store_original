# CryptoBook Store — TODO

## Phase 1: Foundation
- [x] Design system: dark navy/gold CSS variables in index.css
- [x] Database schema: books, orders, order_items, cart_items, wishlists, reviews, chatbot_knowledge, crypto_transactions
- [x] Seed data: 20 books with RSA keys, hashes, genres, ratings, reviews, knowledge base
- [x] Google Fonts: Playfair Display + Inter

## Phase 2: Backend tRPC Routers
- [x] books router: list, getById, search, filter, featured, bestsellers, byGenre, genres, create, update, delete
- [x] cart router: getCart, addItem, updateQty, removeItem, clearCart
- [x] orders router: createOrder, myOrders, getOrderById, all (admin), updateStatus (admin)
- [x] payment router: initiateCryptoPayment (dummy ETH/BTC/LTC), checkPaymentStatus, confirmPayment, getRates
- [x] reviews router: addReview, getReviews
- [x] wishlist router: get, getIds, toggle
- [x] chatbot router: chat (LLM + knowledge base), getKnowledge (admin), upsertKnowledge, deleteKnowledge
- [x] admin router: stats, topBooks, recentOrders
- [x] adminProcedure role guard

## Phase 3: Core Storefront
- [x] Navbar with search, cart badge, user menu, dark/gold theme, mobile responsive
- [x] Hero banner with featured books and stats bar
- [x] Category horizontal carousels (Technology, Business, Science, Fiction, Thriller)
- [x] Book catalog grid with search, filters (genre, price, rating), sort, pagination
- [x] BookCard component with hover effects, wishlist toggle, add to cart
- [x] Book detail page: cover, author, description, reviews, integrity badge, Add to Cart

## Phase 4: Cart & Checkout
- [x] CartContext + CartDrawer slide-out with quantity management
- [x] Order summary panel in checkout
- [x] Checkout multi-step form (review → shipping → payment → success)
- [x] Crypto payment step: ETH/BTC/LTC dummy API call with wallet address
- [x] Transaction hash display + simulated confirmation with block number
- [x] Order success page with order ID

## Phase 5: Cryptographic Integrity
- [x] RSA public key + SHA-256 hash stored per book in database
- [x] IntegrityBadge component on book detail page
- [x] Verification modal: public key, hash, signature timestamp, copy buttons
- [x] "Cryptographically Verified" green badge with glow effect

## Phase 6: AI Chatbot
- [x] Floating ChatbotWidget (bottom-right) with open/close animation
- [x] LLM integration with knowledge base context injection
- [x] Conversation history passed to LLM (last 10 messages)
- [x] Suggested questions on first open
- [x] Typing indicator while waiting for response

## Phase 7: Admin Dashboard
- [x] Role-gated admin routes (admin only)
- [x] Overview tab: stats cards, top books bar chart, recent orders
- [x] Books tab: full CRUD (create, edit, delete) with cover preview
- [x] Orders tab: all orders table, status update dropdown
- [x] AI Training tab: knowledge base CRUD (Q&A pairs, category, priority, keywords, active toggle)

## Phase 8: User Pages
- [x] User profile page with Orders / Wishlist / Account tabs
- [x] Order history with item details and transaction hash
- [x] Wishlist grid with remove button
- [x] SPA routing wired in Wouter (all routes: /, /catalog, /book/:id, /checkout, /profile, /admin)
- [x] CartDrawer and ChatbotWidget mounted globally in App.tsx
- [x] Lazy-loaded pages for code splitting

## Phase 9: Polish & Delivery
- [x] Page transition animations (page-enter keyframe)
- [x] Responsive layout (mobile/tablet/desktop)
- [x] Loading skeletons and spinners
- [x] 19 Vitest unit tests passing (auth, books, cart, wishlist, payment, admin)
- [x] TypeScript: 0 errors
- [x] Route fixes: dead /orders and /wishlist links → /profile
- [x] Final checkpoint saved

## Phase 10: Book File Upload & Delivery (S3 + Real SHA-256 Integrity)
- [x] DB schema: add fileKey, fileUrl, fileName, fileSize, fileMimeType, fileHash (real SHA-256 from file bytes) to books table
- [x] Backend: multipart upload endpoint (POST /api/upload/book-file) with SHA-256 computation server-side
- [x] Backend: tRPC books.uploadFile procedure (admin only) — stores S3 key + real hash in DB
- [x] Backend: tRPC books.download procedure — verifies purchase, returns presigned S3 URL
- [x] Backend: tRPC books.removeFile procedure (admin only) — clears file fields
- [x] Admin UI: drag-and-drop file uploader in book edit form (PDF/ePub), upload progress bar, hash display
- [x] Admin UI: file status badge (uploaded/not uploaded), remove file button
- [x] Customer UI: Download button on book detail page (visible only if purchased + file available)
- [x] Customer UI: Download button on profile order history for each purchased book
- [x] Integrity badge: update to show real file hash when file is uploaded, fallback to metadata hash

## Phase 11: Email Delivery Notifications (HMAC-SHA256 Signed Links)
- [x] DB schema: add download_tokens table (token, signature, bookId, orderId, userId, expiresAt, downloadCount, maxDownloads)
- [x] Backend: generateDownloadToken helper (HMAC-SHA256 signed, 48h expiry, stored in DB)
- [x] Backend: GET /api/download/:token public endpoint — validates HMAC signature + expiry + download limit, redirects to presigned S3 URL
- [x] Backend: sendBookDeliveryEmail helper — builds dark navy/gold HTML email with signed download links per book
- [x] Backend: trigger email after payment.confirm — for each book in order, generate token + send email (non-blocking)
- [x] Frontend: show email delivery banner (sent/failed) on checkout success screen with HMAC security details
- [x] Frontend: show HMAC security notice + Resend links button per order in profile order history
- [x] Tests: 24 tests covering HMAC signing, tamper detection, expiry, download limits, email URL format (62 total passing)

## Phase 12: Admin Token Revocation
- [x] DB schema: add revokedAt (timestamp nullable) + revokedBy (int nullable, admin userId) to download_tokens
- [x] Backend: update validateDownloadToken to reject tokens where revokedAt IS NOT NULL (checked before expiry)
- [x] Backend: add db.revokeTokensByOrderId helper — sets revokedAt + revokedBy for all tokens of an order
- [x] Backend: add books.revokeOrderTokens adminProcedure (input: orderId) — calls helper, returns count revoked
- [x] Backend: add books.getOrderTokenStatus + books.restoreOrderTokens adminProcedures
- [x] Admin UI: Revoke Access button in Orders tab per order row (red, visible only for confirmed orders)
- [x] Admin UI: AlertDialog with live token status (active/expired/revoked counts) + warning banner before revoking
- [x] Admin UI: Restore Access button (green) to un-revoke tokens with confirmation dialog
- [x] Admin UI: toast feedback with count of revoked/restored tokens
- [x] Tests: 13 new revocation tests (guard order, tamper+revoke, restore, DB helpers) — 73 total passing

## Phase 13: PDF Book Preview Reader + USDT/BSC Payment

### PDF Preview Reader
- [x] Install react-pdf (pdfjs-dist) and configure worker
- [x] Backend: tRPC books.previewUrl procedure — generates short-TTL presigned S3 URL for any book with a file (no purchase required)
- [x] BookPreviewReader component: react-pdf Document/Page, prev/next navigation, page counter, zoom in/out, fullscreen modal
- [x] Book detail page: "Read Sample" button (visible when book has a PDF file), opens preview modal
- [x] Preview modal: shows first 10 pages, "Buy Full Book" CTA at the end, page limit enforced client-side
- [x] Loading skeleton while PDF loads, error state if file unavailable

### USDT on BSC Payment
- [x] Add USDT (BSC) to CRYPTO_RATES and STORE_WALLETS in routers.ts (BEP-20 address format)
- [x] Dummy payment API: generate BSC-format transaction hash (0x + 64 hex chars), BSCScan explorer link
- [x] Update payment initiation to include USDT/BSC network info (chain: BSC, token: USDT BEP-20)
- [x] Checkout UI: add USDT option with BSC network badge, BEP-20 disclaimer, BSCScan link on confirmation
- [x] Update crypto rates display to show USDT (1:1 USD peg)
- [x] Tests: 24 USDT/BSC + PDF preview tests — 108 total passing
