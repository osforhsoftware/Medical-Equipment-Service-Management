-- Asset tag prefix and per-prefix sequence counters.
-- Take a full database backup before applying this migration.
-- Existing equipment rows, asset tags, and relationships are not modified.
-- Uniqueness of equipment.asset_tag per tenant is already enforced.

ALTER TABLE `tenant_settings`
  ADD COLUMN `asset_tag_prefix` VARCHAR(20) NULL;

CREATE TABLE `asset_tag_sequences` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `prefix` VARCHAR(20) NOT NULL,
    `next_sequence` INT NOT NULL DEFAULT 1001,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `asset_tag_sequences_tenant_id_prefix_key`(`tenant_id`, `prefix`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `asset_tag_sequences`
  ADD CONSTRAINT `asset_tag_sequences_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
