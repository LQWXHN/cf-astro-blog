CREATE TABLE `friend_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`site_url` text NOT NULL,
	`avatar_url` text,
	`description` text NOT NULL,
	`contact` text NOT NULL,
	`note` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`review_note` text,
	`reviewed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friend_links_site_url_unique` ON `friend_links` (`site_url`);--> statement-breakpoint
CREATE INDEX `friend_links_status_idx` ON `friend_links` (`status`);--> statement-breakpoint
CREATE TABLE `mcp_audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ip_address` text,
	`request_method` text NOT NULL,
	`request_path` text NOT NULL,
	`session_id` text,
	`auth_state` text NOT NULL,
	`response_status` integer NOT NULL,
	`outcome` text NOT NULL,
	`mcp_method` text,
	`tool_name` text,
	`request_id` text,
	`detail` text,
	`user_agent` text,
	`timestamp` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mcp_audit_logs_timestamp_idx` ON `mcp_audit_logs` (`timestamp`);--> statement-breakpoint
CREATE INDEX `mcp_audit_logs_status_idx` ON `mcp_audit_logs` (`response_status`,`timestamp`);--> statement-breakpoint
CREATE INDEX `mcp_audit_logs_tool_idx` ON `mcp_audit_logs` (`tool_name`,`timestamp`);--> statement-breakpoint
CREATE INDEX `mcp_audit_logs_ip_idx` ON `mcp_audit_logs` (`ip_address`,`timestamp`);--> statement-breakpoint
CREATE TABLE `site_appearance_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`background_image_key` text,
	`background_opacity` integer DEFAULT 72 NOT NULL,
	`background_blur` integer DEFAULT 24 NOT NULL,
	`background_scale` integer DEFAULT 112 NOT NULL,
	`background_position_x` integer DEFAULT 50 NOT NULL,
	`background_position_y` integer DEFAULT 50 NOT NULL,
	`hero_card_opacity` integer DEFAULT 14 NOT NULL,
	`hero_card_blur` integer DEFAULT 18 NOT NULL,
	`post_card_opacity` integer DEFAULT 14 NOT NULL,
	`post_card_blur` integer DEFAULT 18 NOT NULL,
	`article_panel_opacity` integer DEFAULT 14 NOT NULL,
	`article_panel_blur` integer DEFAULT 18 NOT NULL,
	`header_subtitle` text DEFAULT '流畅、克制、持续更新的技术写作' NOT NULL,
	`nav_link_1_label` text DEFAULT '首页' NOT NULL,
	`nav_link_1_href` text DEFAULT '/' NOT NULL,
	`nav_link_2_label` text DEFAULT '归档' NOT NULL,
	`nav_link_2_href` text DEFAULT '/blog' NOT NULL,
	`nav_link_3_label` text DEFAULT '搜索' NOT NULL,
	`nav_link_3_href` text DEFAULT '/search' NOT NULL,
	`nav_links_json` text,
	`hero_kicker` text DEFAULT '云端记录' NOT NULL,
	`hero_title` text DEFAULT '把工程判断写清楚，把技术细节写漂亮。' NOT NULL,
	`hero_intro` text DEFAULT '这里记录 Cloudflare、前端工程、调试过程和系统设计里那些值得反复回看的瞬间。界面会继续打磨，但内容先要足够清晰、足够耐读。' NOT NULL,
	`hero_main_image_path` text,
	`hero_primary_label` text DEFAULT '进入归档' NOT NULL,
	`hero_primary_href` text DEFAULT '/blog' NOT NULL,
	`hero_secondary_label` text DEFAULT '站内搜索' NOT NULL,
	`hero_secondary_href` text DEFAULT '/search' NOT NULL,
	`hero_actions_json` text,
	`hero_signal_label` text DEFAULT 'Scene Depth' NOT NULL,
	`hero_signal_heading` text DEFAULT '首页会跟着你的视线轻轻转一下' NOT NULL,
	`hero_signal_copy` text DEFAULT '不是把页面做得很吵，而是只让首屏层次、信息胶囊和按钮反馈更有呼吸感。' NOT NULL,
	`hero_signal_image_path` text,
	`hero_signal_chip_1` text DEFAULT 'Mouse Sync' NOT NULL,
	`hero_signal_chip_2` text DEFAULT 'Soft Orbit' NOT NULL,
	`hero_signal_chip_3` text DEFAULT 'Card Lift' NOT NULL,
	`article_sidebar_avatar_path` text,
	`article_sidebar_name` text DEFAULT 'Eric-Terminal' NOT NULL,
	`article_sidebar_bio` text DEFAULT '在比特海里未雨绸缪，身后养着一只叫晖的狐狸。' NOT NULL,
	`article_sidebar_badge` text DEFAULT '文章作者' NOT NULL,
	`friend_apply_notice` text DEFAULT '' NOT NULL,
	`ai_internal_enabled` integer DEFAULT false NOT NULL,
	`ai_internal_base_url` text DEFAULT 'https://api.openai.com/v1' NOT NULL,
	`ai_internal_api_key` text DEFAULT '' NOT NULL,
	`ai_internal_model` text DEFAULT 'gpt-4o-mini' NOT NULL,
	`ai_public_enabled` integer DEFAULT false NOT NULL,
	`ai_public_base_url` text DEFAULT 'https://api.openai.com/v1' NOT NULL,
	`ai_public_api_key` text DEFAULT '' NOT NULL,
	`ai_public_model` text DEFAULT 'gpt-4o-mini' NOT NULL,
	`mcp_enabled` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tool_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tool_categories_name_unique` ON `tool_categories` (`name`);--> statement-breakpoint
CREATE INDEX `tool_categories_name_idx` ON `tool_categories` (`name`);--> statement-breakpoint
CREATE INDEX `tool_categories_sort_idx` ON `tool_categories` (`sort_order`);--> statement-breakpoint
CREATE TABLE `tool_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`url` text NOT NULL,
	`icon` text,
	`sort_order` integer DEFAULT 0,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `tool_categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tool_items_category_idx` ON `tool_items` (`category_id`);--> statement-breakpoint
CREATE INDEX `tool_items_name_idx` ON `tool_items` (`name`);--> statement-breakpoint
CREATE INDEX `tool_items_sort_idx` ON `tool_items` (`sort_order`);--> statement-breakpoint
CREATE TABLE `web_mentions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_url` text NOT NULL,
	`target_url` text NOT NULL,
	`source_title` text,
	`source_excerpt` text,
	`source_author` text,
	`source_published_at` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`review_note` text,
	`reviewed_at` text,
	`last_checked_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `web_mentions_status_idx` ON `web_mentions` (`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `web_mentions_source_target_unique` ON `web_mentions` (`source_url`,`target_url`);--> statement-breakpoint
ALTER TABLE `analytics_events` ADD `ip_address` text;--> statement-breakpoint
ALTER TABLE `analytics_events` ADD `user_agent` text;--> statement-breakpoint
ALTER TABLE `analytics_sessions` ADD `ip_address` text;--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `background_mode` text DEFAULT 'global' NOT NULL;--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `background_image_key` text;--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `background_opacity` integer DEFAULT 72 NOT NULL;--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `background_blur` integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `background_scale` integer DEFAULT 112 NOT NULL;--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `background_position_x` integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `background_position_y` integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `is_pinned` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `blog_posts` ADD `pinned_order` integer DEFAULT 100 NOT NULL;--> statement-breakpoint
CREATE INDEX `posts_pinned_order_idx` ON `blog_posts` (`is_pinned`,`pinned_order`,`published_at`);