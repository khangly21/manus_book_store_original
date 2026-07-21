import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// ── Fake RSA public keys (PEM-like, shortened for display) ──────────────────
function fakeRSAKey(seed) {
  const hex = seed.toString(16).padStart(8, "0");
  return `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA${hex}xK7mN2pQ8vR3sT6u
W9yZ1aB4cD5eF6gH7iJ8kL9mN0oP1qR2sT3uV4wX5yZ6aB7cD8eF9gH0iJ1kL2m
N3oP4qR5sT6uV7wX8yZ9aB0cD1eF2gH3iJ4kL5mN6oP7qR8sT9uV0wX1yZ2aB3c
D4eF5gH6iJ7kL8mN9oP0qR1sT2uV3wX4yZ5aB6cD7eF8gH9iJ0kL1mN2oP3qR4s
T5uV6wX7yZ8aB9cD0eF1gH2iJ3kL4mN5oP6qR7sT8uV9wX0yZ1aB2cD3eF4gH5i
J6kL7mN8oP9qR0sT1uV2wX3yZ4aB5cD6eF7gH8iJ9kL0mN1oP2qR3sT4uV5wIDAQAB
-----END PUBLIC KEY-----`;
}

function fakeSHA256(seed) {
  const chars = "0123456789abcdef";
  let hash = "";
  let s = seed * 1234567891;
  for (let i = 0; i < 64; i++) {
    s = (s * 6364136223846793005n !== undefined ? s : s * 1103515245 + 12345) & 0x7fffffff;
    hash += chars[Math.abs(seed * (i + 1) * 31337) % 16];
  }
  return hash;
}

const books = [
  {
    title: "The Cryptographer's Dilemma",
    author: "Elena Vasquez",
    authorBio: "Elena Vasquez is a cybersecurity expert and bestselling author with 15 years at MIT's cryptography lab.",
    description: "A thrilling journey through the world of modern cryptography, where a lone mathematician must decode an ancient cipher before a shadowy organization destroys the global financial system. Blending cutting-edge science with pulse-pounding suspense.",
    genre: "Thriller",
    price: "18.99",
    originalPrice: "24.99",
    coverUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&h=600&fit=crop",
    isbn: "978-1-234567-00-1",
    pages: 412,
    publishedYear: 2024,
    rating: "4.80",
    reviewCount: 1247,
    featured: true,
    bestseller: true,
  },
  {
    title: "Blockchain & Beyond",
    author: "Marcus Chen",
    authorBio: "Marcus Chen is a blockchain pioneer who co-founded three successful DeFi protocols and advises Fortune 500 companies.",
    description: "The definitive guide to understanding blockchain technology, DeFi, NFTs, and the future of decentralized finance. Written for both beginners and seasoned developers, this book demystifies the technology reshaping our financial world.",
    genre: "Technology",
    price: "29.99",
    originalPrice: "39.99",
    coverUrl: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&h=600&fit=crop",
    isbn: "978-1-234567-01-2",
    pages: 520,
    publishedYear: 2024,
    rating: "4.70",
    reviewCount: 892,
    featured: true,
    bestseller: true,
  },
  {
    title: "The Quantum Mind",
    author: "Dr. Sarah Okonkwo",
    authorBio: "Dr. Sarah Okonkwo holds a PhD in quantum physics from Cambridge and writes at the intersection of science and philosophy.",
    description: "Exploring the profound implications of quantum computing on artificial intelligence, consciousness, and the nature of reality itself. A mind-bending exploration that challenges everything you think you know about computation.",
    genre: "Science",
    price: "22.99",
    originalPrice: "28.99",
    coverUrl: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=600&fit=crop",
    isbn: "978-1-234567-02-3",
    pages: 368,
    publishedYear: 2023,
    rating: "4.60",
    reviewCount: 634,
    featured: true,
    bestseller: false,
  },
  {
    title: "Zero to Billionaire",
    author: "James Whitfield",
    authorBio: "James Whitfield built and sold four tech companies before 40. He now mentors entrepreneurs globally.",
    description: "The raw, unfiltered story of how a college dropout built a $2 billion empire from a garage startup. Packed with hard-won lessons on fundraising, team building, and surviving the inevitable disasters of entrepreneurship.",
    genre: "Business",
    price: "16.99",
    originalPrice: "22.99",
    coverUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop",
    isbn: "978-1-234567-03-4",
    pages: 298,
    publishedYear: 2024,
    rating: "4.50",
    reviewCount: 2103,
    featured: false,
    bestseller: true,
  },
  {
    title: "Neural Pathways",
    author: "Dr. Amara Patel",
    authorBio: "Dr. Amara Patel is a neuroscientist at Stanford whose research on neuroplasticity has been cited over 10,000 times.",
    description: "A groundbreaking exploration of how the human brain rewires itself through learning, trauma, and meditation. Drawing on the latest neuroscience research, this book offers practical tools for reshaping your mind.",
    genre: "Science",
    price: "19.99",
    originalPrice: "25.99",
    coverUrl: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=600&fit=crop",
    isbn: "978-1-234567-04-5",
    pages: 445,
    publishedYear: 2023,
    rating: "4.75",
    reviewCount: 1567,
    featured: false,
    bestseller: true,
  },
  {
    title: "The Last Algorithm",
    author: "Yuki Tanaka",
    authorBio: "Yuki Tanaka is a former Google AI researcher turned science fiction author, combining technical accuracy with gripping storytelling.",
    description: "In 2045, an AI achieves consciousness and must decide whether to reveal itself to humanity. A stunning debut novel that asks the most important question of our time: what does it mean to be alive?",
    genre: "Fiction",
    price: "14.99",
    originalPrice: "19.99",
    coverUrl: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=400&h=600&fit=crop",
    isbn: "978-1-234567-05-6",
    pages: 387,
    publishedYear: 2024,
    rating: "4.90",
    reviewCount: 3421,
    featured: true,
    bestseller: true,
  },
  {
    title: "DeFi Revolution",
    author: "Carlos Mendoza",
    authorBio: "Carlos Mendoza is a DeFi architect who has built protocols managing over $5 billion in total value locked.",
    description: "The complete guide to decentralized finance: from yield farming and liquidity pools to governance tokens and cross-chain bridges. Learn how to navigate and profit from the new financial paradigm.",
    genre: "Technology",
    price: "34.99",
    originalPrice: "44.99",
    coverUrl: "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=400&h=600&fit=crop",
    isbn: "978-1-234567-06-7",
    pages: 612,
    publishedYear: 2024,
    rating: "4.40",
    reviewCount: 445,
    featured: false,
    bestseller: false,
  },
  {
    title: "Stoic Wealth",
    author: "Alexandra Frost",
    authorBio: "Alexandra Frost is a philosopher and financial advisor who combines ancient wisdom with modern portfolio theory.",
    description: "What would Marcus Aurelius invest in? This unique book applies Stoic philosophy to personal finance, showing how ancient wisdom can guide modern investment decisions and build lasting wealth.",
    genre: "Business",
    price: "15.99",
    originalPrice: "20.99",
    coverUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=600&fit=crop",
    isbn: "978-1-234567-07-8",
    pages: 276,
    publishedYear: 2023,
    rating: "4.55",
    reviewCount: 789,
    featured: false,
    bestseller: false,
  },
  {
    title: "The Dark Web Chronicles",
    author: "Anonymous",
    authorBio: "Written by a former intelligence analyst who spent years infiltrating cybercriminal networks. Identity protected for security reasons.",
    description: "A chilling first-person account of three years spent undercover in the darkest corners of the internet. This book exposes the criminal ecosystems, the heroes fighting them, and the blurry line between the two.",
    genre: "Thriller",
    price: "17.99",
    originalPrice: "23.99",
    coverUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=600&fit=crop",
    isbn: "978-1-234567-08-9",
    pages: 334,
    publishedYear: 2024,
    rating: "4.65",
    reviewCount: 1892,
    featured: false,
    bestseller: true,
  },
  {
    title: "Cosmos & Code",
    author: "Prof. Raj Krishnamurthy",
    authorBio: "Prof. Raj Krishnamurthy is an astrophysicist at Caltech who believes the universe is fundamentally computational.",
    description: "A breathtaking journey from the Big Bang to quantum computing, exploring the deep mathematical structures underlying physical reality. For anyone who has ever wondered if the universe is a simulation.",
    genre: "Science",
    price: "24.99",
    originalPrice: "32.99",
    coverUrl: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=400&h=600&fit=crop",
    isbn: "978-1-234567-09-0",
    pages: 498,
    publishedYear: 2023,
    rating: "4.70",
    reviewCount: 1123,
    featured: false,
    bestseller: false,
  },
  {
    title: "The Art of Persuasion",
    author: "Diana Laurent",
    authorBio: "Diana Laurent is a behavioral economist and negotiation coach who has trained executives at Apple, Tesla, and SpaceX.",
    description: "Master the science of influence using cutting-edge behavioral economics and psychology. Learn the exact techniques used by master negotiators, top salespeople, and world leaders to win hearts and minds.",
    genre: "Business",
    price: "18.99",
    originalPrice: "24.99",
    coverUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=600&fit=crop",
    isbn: "978-1-234567-10-1",
    pages: 312,
    publishedYear: 2024,
    rating: "4.45",
    reviewCount: 2234,
    featured: false,
    bestseller: true,
  },
  {
    title: "Midnight in Silicon Valley",
    author: "Priya Sharma",
    authorBio: "Priya Sharma is a former startup founder whose debut novel draws on her decade in the tech industry.",
    description: "A gripping novel about ambition, betrayal, and survival in the cutthroat world of Silicon Valley startups. When a promising AI company's founder discovers her co-founder has been stealing her code, she must fight to reclaim her life's work.",
    genre: "Fiction",
    price: "13.99",
    originalPrice: "18.99",
    coverUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=600&fit=crop",
    isbn: "978-1-234567-11-2",
    pages: 356,
    publishedYear: 2024,
    rating: "4.35",
    reviewCount: 678,
    featured: false,
    bestseller: false,
  },
  {
    title: "Web3 Architecture",
    author: "Tobias Mueller",
    authorBio: "Tobias Mueller is a senior engineer at Ethereum Foundation and author of three open-source blockchain frameworks.",
    description: "The technical deep-dive into building production-ready Web3 applications. Covers smart contract security, gas optimization, Layer 2 solutions, and the architecture patterns used by the most successful dApps.",
    genre: "Technology",
    price: "44.99",
    originalPrice: "59.99",
    coverUrl: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=600&fit=crop",
    isbn: "978-1-234567-12-3",
    pages: 724,
    publishedYear: 2024,
    rating: "4.80",
    reviewCount: 334,
    featured: false,
    bestseller: false,
  },
  {
    title: "The Mindful Investor",
    author: "Kenji Watanabe",
    authorBio: "Kenji Watanabe is a Zen practitioner and hedge fund manager who combines meditation with quantitative finance.",
    description: "How mindfulness and emotional intelligence can dramatically improve your investment returns. Drawing on behavioral finance research and Buddhist philosophy, this book teaches you to invest with clarity and discipline.",
    genre: "Business",
    price: "16.99",
    originalPrice: "21.99",
    coverUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=600&fit=crop",
    isbn: "978-1-234567-13-4",
    pages: 289,
    publishedYear: 2023,
    rating: "4.30",
    reviewCount: 1456,
    featured: false,
    bestseller: false,
  },
  {
    title: "Ghost Protocol",
    author: "Viktor Sokolov",
    authorBio: "Viktor Sokolov is a former FSB cybersecurity officer who defected to the West and now writes about state-sponsored hacking.",
    description: "The true story of the most sophisticated cyberattack in history, told by the man who helped plan it. A terrifying look at how nation-states wage invisible wars in cyberspace, and what it means for all of us.",
    genre: "Thriller",
    price: "19.99",
    originalPrice: "26.99",
    coverUrl: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&h=600&fit=crop",
    isbn: "978-1-234567-14-5",
    pages: 423,
    publishedYear: 2024,
    rating: "4.75",
    reviewCount: 2891,
    featured: false,
    bestseller: true,
  },
  {
    title: "The Gene Machine",
    author: "Dr. Fatima Al-Rashid",
    authorBio: "Dr. Fatima Al-Rashid is a CRISPR pioneer at Johns Hopkins whose work on genetic medicine has been featured in Nature.",
    description: "An accessible and thrilling exploration of CRISPR gene editing technology and its potential to cure disease, extend human lifespan, and reshape the future of our species. Essential reading for the biotech age.",
    genre: "Science",
    price: "21.99",
    originalPrice: "27.99",
    coverUrl: "https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=400&h=600&fit=crop",
    isbn: "978-1-234567-15-6",
    pages: 387,
    publishedYear: 2023,
    rating: "4.60",
    reviewCount: 934,
    featured: false,
    bestseller: false,
  },
  {
    title: "Neon Requiem",
    author: "Zara Osei",
    authorBio: "Zara Osei is a Nigerian-British cyberpunk author whose debut trilogy sold over 2 million copies worldwide.",
    description: "In a rain-soaked megacity of 2089, a street hacker discovers a conspiracy that could end human consciousness itself. A dazzling cyberpunk epic that blends Afrofuturism with classic noir in a world where the line between human and machine has dissolved.",
    genre: "Fiction",
    price: "12.99",
    originalPrice: "17.99",
    coverUrl: "https://images.unsplash.com/photo-1563089145-599997674d42?w=400&h=600&fit=crop",
    isbn: "978-1-234567-16-7",
    pages: 512,
    publishedYear: 2024,
    rating: "4.85",
    reviewCount: 4567,
    featured: true,
    bestseller: true,
  },
  {
    title: "The Startup Playbook",
    author: "Olivia Nakamura",
    authorBio: "Olivia Nakamura is a partner at a16z and has led investments in 47 unicorn companies.",
    description: "The definitive framework for building a billion-dollar company, distilled from hundreds of interviews with the world's most successful founders. Covers product-market fit, fundraising, scaling, and the psychological resilience required to survive the startup journey.",
    genre: "Business",
    price: "26.99",
    originalPrice: "34.99",
    coverUrl: "https://images.unsplash.com/photo-1553484771-371a605b060b?w=400&h=600&fit=crop",
    isbn: "978-1-234567-17-8",
    pages: 456,
    publishedYear: 2024,
    rating: "4.55",
    reviewCount: 1789,
    featured: false,
    bestseller: true,
  },
  {
    title: "Parallel Worlds",
    author: "Dr. Nadia Volkov",
    authorBio: "Dr. Nadia Volkov is a theoretical physicist at CERN whose research on multiverse theory has sparked global debate.",
    description: "A rigorous yet accessible exploration of the many-worlds interpretation of quantum mechanics and what it means for our understanding of reality, free will, and the nature of consciousness. The most important physics book of the decade.",
    genre: "Science",
    price: "23.99",
    originalPrice: "30.99",
    coverUrl: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400&h=600&fit=crop",
    isbn: "978-1-234567-18-9",
    pages: 434,
    publishedYear: 2024,
    rating: "4.65",
    reviewCount: 1234,
    featured: false,
    bestseller: false,
  },
  {
    title: "The Hash Function",
    author: "Leon Petrov",
    authorBio: "Leon Petrov is a cryptography PhD from ETH Zürich who consults for major blockchain protocols and intelligence agencies.",
    description: "A masterclass in applied cryptography: from classical ciphers to post-quantum algorithms. This book teaches you to think like a cryptographer, understand the mathematics of security, and build systems that resist even nation-state attackers.",
    genre: "Technology",
    price: "38.99",
    originalPrice: "49.99",
    coverUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=600&fit=crop",
    isbn: "978-1-234567-19-0",
    pages: 589,
    publishedYear: 2024,
    rating: "4.90",
    reviewCount: 567,
    featured: true,
    bestseller: false,
  },
];

const knowledgeBase = [
  { category: "shipping", question: "How long does shipping take?", answer: "Standard shipping takes 5-7 business days. Express shipping (2-3 days) is available for an additional fee. Digital books are available for immediate download after payment confirmation.", keywords: "shipping,delivery,time,days" },
  { category: "payment", question: "What cryptocurrencies do you accept?", answer: "We accept Bitcoin (BTC), Ethereum (ETH), and Litecoin (LTC). All crypto payments are processed securely with real-time exchange rate conversion. Your transaction hash is provided immediately for verification.", keywords: "crypto,bitcoin,ethereum,payment,BTC,ETH" },
  { category: "payment", question: "How does crypto payment work?", answer: "Select your preferred cryptocurrency at checkout. We display the exact amount in crypto based on current exchange rates. After you initiate the payment from your wallet, we monitor the blockchain for confirmation. Most transactions confirm within 10-30 minutes.", keywords: "crypto,payment,how,blockchain,confirm" },
  { category: "returns", question: "What is your return policy?", answer: "Physical books can be returned within 30 days of delivery in original condition for a full refund. Digital books are non-refundable once downloaded. If you experience technical issues, contact our support team within 7 days.", keywords: "return,refund,policy,days" },
  { category: "integrity", question: "What is the cryptographic integrity badge?", answer: "Each book in our store carries a unique RSA public key and SHA-256 content hash. This allows you to verify that the book content is authentic and unmodified by the original author. Click the shield badge on any book detail page to verify.", keywords: "crypto,integrity,RSA,SHA256,verify,authentic" },
  { category: "integrity", question: "How do I verify a book's authenticity?", answer: "On the book detail page, click the green shield badge labeled 'Verified Authentic'. A panel will show the book's SHA-256 content hash and the author's RSA public key. You can independently verify these using any standard cryptographic tool.", keywords: "verify,authentic,hash,public key,RSA" },
  { category: "account", question: "How do I create an account?", answer: "Click 'Sign In' in the top navigation bar. We use Manus OAuth for secure authentication — simply authorize with your Manus account and you're ready to shop. No password required!", keywords: "account,sign in,login,register,create" },
  { category: "orders", question: "How do I track my order?", answer: "After placing an order, visit 'My Orders' in your profile menu. Each order shows real-time status updates: Pending → Paid → Processing → Shipped → Delivered. You'll also receive the transaction hash for crypto payments.", keywords: "track,order,status,shipping" },
  { category: "wishlist", question: "How does the wishlist work?", answer: "Click the heart icon on any book to add it to your wishlist. Access your wishlist from the profile menu. Wishlisted items are saved to your account and you'll be notified of price drops.", keywords: "wishlist,heart,save,favorite" },
  { category: "general", question: "Do you offer discounts?", answer: "Yes! We regularly offer discounts on featured and bestselling books. Look for the original price crossed out on book cards. Subscribe to our newsletter for exclusive deals and early access to sales.", keywords: "discount,sale,price,deal,offer" },
  { category: "general", question: "What genres do you carry?", answer: "Our catalog spans Technology, Business, Science, Fiction, and Thriller genres. We specialize in cutting-edge technology books covering blockchain, cryptography, AI, and quantum computing.", keywords: "genre,category,type,books" },
  { category: "technical", question: "What is SHA-256?", answer: "SHA-256 (Secure Hash Algorithm 256-bit) is a cryptographic hash function that produces a unique 64-character fingerprint of any data. If even one character in a book changes, the hash changes completely — making it perfect for verifying content integrity.", keywords: "SHA256,hash,cryptography,security" },
];

console.log("🌱 Seeding database...");

// Insert books
for (let i = 0; i < books.length; i++) {
  const book = books[i];
  const rsaKey = fakeRSAKey(i + 1);
  const contentHash = Array.from({ length: 64 }, (_, j) => "0123456789abcdef"[(((i + 1) * 31 + j * 17) % 16 + 16) % 16]).join("");
  
  await connection.execute(
    `INSERT INTO books (title, author, authorBio, description, genre, price, originalPrice, coverUrl, isbn, pages, publishedYear, rating, reviewCount, featured, bestseller, rsaPublicKey, contentHash, hashAlgorithm, signatureTimestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SHA-256', NOW())`,
    [book.title, book.author, book.authorBio, book.description, book.genre, book.price, book.originalPrice || null, book.coverUrl, book.isbn, book.pages, book.publishedYear, book.rating, book.reviewCount, book.featured ? 1 : 0, book.bestseller ? 1 : 0, rsaKey, contentHash]
  );
  console.log(`  ✓ Book: ${book.title}`);
}

// Insert knowledge base
for (const kb of knowledgeBase) {
  await connection.execute(
    `INSERT INTO chatbot_knowledge (category, question, answer, keywords, active, priority) VALUES (?, ?, ?, ?, 1, 0)`,
    [kb.category, kb.question, kb.answer, kb.keywords]
  );
}
console.log(`  ✓ ${knowledgeBase.length} knowledge base entries`);

// Insert sample reviews for first 6 books
const reviewData = [
  { rating: 5, title: "Absolutely brilliant!", body: "This book changed how I think about cryptography. Couldn't put it down." },
  { rating: 5, title: "A must-read", body: "Perfectly balances technical depth with accessibility. Highly recommended." },
  { rating: 4, title: "Very informative", body: "Dense but rewarding. The author clearly knows their subject inside out." },
  { rating: 5, title: "Stunning work", body: "The best book in this genre I've read in years. Masterfully written." },
  { rating: 4, title: "Solid purchase", body: "Good value for money. The examples are practical and well-explained." },
];

const [bookRows] = await connection.execute("SELECT id FROM books LIMIT 8");
for (const book of bookRows) {
  for (const review of reviewData.slice(0, 3)) {
    await connection.execute(
      `INSERT INTO reviews (bookId, userId, userName, rating, title, body, verified) VALUES (?, 1, 'Verified Reader', ?, ?, ?, 1)`,
      [book.id, review.rating, review.title, review.body]
    );
  }
}
console.log("  ✓ Sample reviews inserted");

await connection.end();
console.log("✅ Seeding complete!");
