CREATE TABLE `books` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(512) NOT NULL,
	`author` varchar(256) NOT NULL,
	`authorBio` text,
	`description` text,
	`genre` varchar(64) NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`originalPrice` decimal(10,2),
	`coverUrl` text,
	`isbn` varchar(32),
	`pages` int,
	`publishedYear` int,
	`language` varchar(32) DEFAULT 'English',
	`rating` decimal(3,2) DEFAULT '0.00',
	`reviewCount` int DEFAULT 0,
	`stock` int DEFAULT 100,
	`featured` boolean DEFAULT false,
	`bestseller` boolean DEFAULT false,
	`rsaPublicKey` text,
	`contentHash` varchar(128),
	`hashAlgorithm` varchar(16) DEFAULT 'SHA-256',
	`signatureTimestamp` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `books_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cart_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`bookId` int NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cart_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chatbot_knowledge` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` varchar(64) DEFAULT 'general',
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`keywords` text,
	`active` boolean DEFAULT true,
	`priority` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chatbot_knowledge_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crypto_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`currency` varchar(16) NOT NULL,
	`amount` decimal(20,8) NOT NULL,
	`usdAmount` decimal(10,2) NOT NULL,
	`txHash` varchar(128) NOT NULL,
	`fromAddress` varchar(128),
	`toAddress` varchar(128) NOT NULL,
	`status` enum('pending','confirming','confirmed','failed') NOT NULL DEFAULT 'pending',
	`confirmations` int DEFAULT 0,
	`blockNumber` int,
	`gasUsed` varchar(64),
	`networkFee` decimal(20,8),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`confirmedAt` timestamp,
	CONSTRAINT `crypto_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`bookId` int NOT NULL,
	`quantity` int NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`bookTitle` varchar(512),
	`bookAuthor` varchar(256),
	`bookCover` text,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`status` enum('pending','paid','processing','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
	`totalAmount` decimal(10,2) NOT NULL,
	`cryptoCurrency` varchar(16),
	`cryptoAmount` decimal(20,8),
	`txHash` varchar(128),
	`walletAddress` varchar(128),
	`paymentStatus` enum('pending','confirming','confirmed','failed') DEFAULT 'pending',
	`shippingAddress` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookId` int NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(256),
	`rating` int NOT NULL,
	`title` varchar(256),
	`body` text,
	`verified` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wishlists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`bookId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wishlists_id` PRIMARY KEY(`id`)
);
