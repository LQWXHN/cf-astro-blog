CREATE TABLE `dashboard_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`icon` text,
	`url` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `dashboard_links_sort_idx` ON `dashboard_links` (`sort_order`);