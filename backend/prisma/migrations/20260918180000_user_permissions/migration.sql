-- Per-user permission set: access mode (crud | read) and optional per-module levels.
ALTER TABLE `users` ADD COLUMN `permissions` JSON NOT NULL DEFAULT (JSON_OBJECT());
