ALTER TABLE `books` ADD `fileKey` varchar(512);--> statement-breakpoint
ALTER TABLE `books` ADD `fileUrl` text;--> statement-breakpoint
ALTER TABLE `books` ADD `fileName` varchar(256);--> statement-breakpoint
ALTER TABLE `books` ADD `fileSize` int;--> statement-breakpoint
ALTER TABLE `books` ADD `fileMimeType` varchar(64);--> statement-breakpoint
ALTER TABLE `books` ADD `fileHash` varchar(128);