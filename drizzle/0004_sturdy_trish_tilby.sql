ALTER TABLE `download_tokens` ADD `revokedAt` timestamp;--> statement-breakpoint
ALTER TABLE `download_tokens` ADD `revokedBy` int;