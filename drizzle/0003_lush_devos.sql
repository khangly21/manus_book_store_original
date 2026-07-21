CREATE TABLE `download_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`signature` varchar(128) NOT NULL,
	`bookId` int NOT NULL,
	`orderId` int NOT NULL,
	`userId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`downloadCount` int NOT NULL DEFAULT 0,
	`maxDownloads` int NOT NULL DEFAULT 5,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `download_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `download_tokens_token_unique` UNIQUE(`token`)
);
