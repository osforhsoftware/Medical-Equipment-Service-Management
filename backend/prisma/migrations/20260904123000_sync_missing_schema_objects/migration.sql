-- Sync production schema gaps that cause Prisma P2022 (missing columns/tables).

-- Password reset tokens
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `token_hash` VARCHAR(191) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `used_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `password_reset_tokens_token_hash_key`(`token_hash`),
  INDEX `password_reset_tokens_user_id_idx`(`user_id`),
  INDEX `password_reset_tokens_expires_at_idx`(`expires_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Stock transfer branch refs + timestamps
ALTER TABLE `stock_transfers`
  ADD COLUMN `from_branch_id` VARCHAR(191) NULL,
  ADD COLUMN `to_branch_id` VARCHAR(191) NULL,
  ADD COLUMN `dispatched_at` DATETIME(3) NULL,
  ADD COLUMN `received_at` DATETIME(3) NULL;

CREATE INDEX `stock_transfers_from_branch_id_idx` ON `stock_transfers`(`from_branch_id`);
CREATE INDEX `stock_transfers_to_branch_id_idx` ON `stock_transfers`(`to_branch_id`);

-- Stock transfer line items
CREATE TABLE IF NOT EXISTS `stock_transfer_lines` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `stock_transfer_id` VARCHAR(191) NOT NULL,
  `source_inventory_item_id` VARCHAR(191) NOT NULL,
  `destination_inventory_item_id` VARCHAR(191) NULL,
  `sku` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NOT NULL,
  `quantity` INTEGER NOT NULL,
  `quantity_received` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `stock_transfer_lines_tenant_id_stock_transfer_id_idx`(`tenant_id`, `stock_transfer_id`),
  INDEX `stock_transfer_lines_source_inventory_item_id_idx`(`source_inventory_item_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign keys (safe if referenced rows exist)
ALTER TABLE `password_reset_tokens`
  ADD CONSTRAINT `password_reset_tokens_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `stock_transfers`
  ADD CONSTRAINT `stock_transfers_from_branch_id_fkey`
  FOREIGN KEY (`from_branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `stock_transfers`
  ADD CONSTRAINT `stock_transfers_to_branch_id_fkey`
  FOREIGN KEY (`to_branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `stock_transfer_lines`
  ADD CONSTRAINT `stock_transfer_lines_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `stock_transfer_lines`
  ADD CONSTRAINT `stock_transfer_lines_stock_transfer_id_fkey`
  FOREIGN KEY (`stock_transfer_id`) REFERENCES `stock_transfers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `stock_transfer_lines`
  ADD CONSTRAINT `stock_transfer_lines_source_inventory_item_id_fkey`
  FOREIGN KEY (`source_inventory_item_id`) REFERENCES `inventory_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `stock_transfer_lines`
  ADD CONSTRAINT `stock_transfer_lines_destination_inventory_item_id_fkey`
  FOREIGN KEY (`destination_inventory_item_id`) REFERENCES `inventory_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
