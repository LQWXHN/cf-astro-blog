CREATE TABLE `api_providers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`base_url` text NOT NULL,
	`api_key` text,
	`auth_type` text DEFAULT 'bearer' NOT NULL,
	`header_name` text DEFAULT 'Authorization',
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_providers_name_unique` ON `api_providers` (`name`);--> statement-breakpoint
CREATE INDEX `api_providers_name_idx` ON `api_providers` (`name`);--> statement-breakpoint
CREATE TABLE `dashboard_cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`card_key` text NOT NULL,
	`title` text NOT NULL,
	`icon` text,
	`type` text DEFAULT 'custom' NOT NULL,
	`content_template` text,
	`size_preset` text DEFAULT 'small' NOT NULL,
	`width` integer DEFAULT 1,
	`height` integer DEFAULT 1,
	`api_provider_id` integer,
	`api_endpoint` text,
	`api_key` text,
	`refresh_interval` integer DEFAULT 0,
	`sort_order` integer DEFAULT 0,
	`is_enabled` integer DEFAULT true,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dashboard_cards_card_key_unique` ON `dashboard_cards` (`card_key`);--> statement-breakpoint
CREATE INDEX `dashboard_cards_key_idx` ON `dashboard_cards` (`card_key`);--> statement-breakpoint
CREATE INDEX `dashboard_cards_type_idx` ON `dashboard_cards` (`type`);--> statement-breakpoint
CREATE TABLE `dashboard_layouts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`layout_data` text NOT NULL,
	`is_default` integer DEFAULT false,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `dashboard_layouts_default_idx` ON `dashboard_layouts` (`is_default`);