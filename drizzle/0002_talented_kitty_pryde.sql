CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content` text NOT NULL,
	`position_left` integer DEFAULT 10 NOT NULL,
	`position_top` integer DEFAULT 10 NOT NULL,
	`rotation` integer DEFAULT 0 NOT NULL,
	`color_theme` text DEFAULT 'yellow' NOT NULL,
	`is_pinned` integer DEFAULT false,
	`visitor_ip` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notes_status_idx` ON `notes` (`status`);--> statement-breakpoint
CREATE INDEX `notes_created_idx` ON `notes` (`created_at`);