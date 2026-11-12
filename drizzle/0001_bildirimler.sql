ALTER TABLE `users` ADD `email` text;--> statement-breakpoint
ALTER TABLE `users` ADD `notify` text DEFAULT 'instant' NOT NULL;--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`subject` text NOT NULL,
	`html` text NOT NULL,
	`text` text NOT NULL,
	`event_key` text NOT NULL,
	`proposal_id` text,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`sent_at` integer
);--> statement-breakpoint
CREATE INDEX `outbox_status` ON `outbox` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `kv` (
	`k` text PRIMARY KEY NOT NULL,
	`v` text NOT NULL
);
