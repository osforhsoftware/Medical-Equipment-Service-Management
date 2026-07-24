-- Complete branding, structured inspection recommendations, and shortage-aware reservations.
ALTER TABLE `tenant_settings`
  ADD COLUMN `logo_file_id` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `tenant_settings_logo_file_id_key`
  ON `tenant_settings`(`logo_file_id`);

ALTER TABLE `tenant_settings`
  ADD CONSTRAINT `tenant_settings_logo_file_id_fkey`
  FOREIGN KEY (`logo_file_id`) REFERENCES `stored_files`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `inspection_recommendations`
  ADD COLUMN `catalog_item_id` VARCHAR(191) NULL,
  ADD COLUMN `inventory_item_id` VARCHAR(191) NULL,
  ADD COLUMN `type` VARCHAR(191) NOT NULL DEFAULT 'other',
  ADD COLUMN `quantity` DECIMAL(12, 3) NOT NULL DEFAULT 1,
  ADD COLUMN `estimated_cost` DECIMAL(12, 2) NOT NULL DEFAULT 0;

CREATE INDEX `inspection_recommendations_catalog_item_id_idx`
  ON `inspection_recommendations`(`catalog_item_id`);

CREATE INDEX `inspection_recommendations_inventory_item_id_idx`
  ON `inspection_recommendations`(`inventory_item_id`);

ALTER TABLE `inspection_recommendations`
  ADD CONSTRAINT `inspection_recommendations_catalog_item_id_fkey`
  FOREIGN KEY (`catalog_item_id`) REFERENCES `service_catalog_items`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `inspection_recommendations_inventory_item_id_fkey`
  FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `stock_reservations`
  ADD COLUMN `requested_quantity` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `shortage_quantity` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `notifications`
  ADD COLUMN `recipient_user_id` VARCHAR(191) NULL,
  ADD COLUMN `recipient_role` VARCHAR(191) NULL,
  ADD COLUMN `delivery_status` VARCHAR(191) NOT NULL DEFAULT 'delivered';

CREATE INDEX `notifications_tenant_id_recipient_user_id_idx`
  ON `notifications`(`tenant_id`, `recipient_user_id`);

CREATE INDEX `notifications_tenant_id_recipient_role_idx`
  ON `notifications`(`tenant_id`, `recipient_role`);

CREATE TABLE `notification_reads` (
  `id` VARCHAR(191) NOT NULL,
  `notification_id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `read_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `notification_reads_notification_id_user_id_key`(`notification_id`, `user_id`),
  INDEX `notification_reads_user_id_read_at_idx`(`user_id`, `read_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `notification_reads`
  ADD CONSTRAINT `notification_reads_notification_id_fkey`
  FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `office_assets`
  ADD COLUMN `salvage_value` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `useful_life_months` INTEGER NULL,
  ADD COLUMN `depreciation_method` VARCHAR(191) NOT NULL DEFAULT 'straight-line',
  ADD COLUMN `location` VARCHAR(191) NULL,
  ADD COLUMN `warranty_end` DATETIME(3) NULL,
  ADD COLUMN `last_maintenance_at` DATETIME(3) NULL,
  ADD COLUMN `next_maintenance_at` DATETIME(3) NULL,
  ADD COLUMN `disposed_at` DATETIME(3) NULL;

CREATE TABLE `office_asset_maintenance` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `office_asset_id` VARCHAR(191) NOT NULL,
  `performed_at` DATETIME(3) NOT NULL,
  `next_maintenance_at` DATETIME(3) NULL,
  `provider` VARCHAR(191) NULL,
  `description` TEXT NOT NULL,
  `cost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `created_by` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `office_asset_maintenance_tenant_id_performed_at_idx`(`tenant_id`, `performed_at`),
  INDEX `office_asset_maintenance_office_asset_id_idx`(`office_asset_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `office_asset_maintenance`
  ADD CONSTRAINT `office_asset_maintenance_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `office_asset_maintenance_office_asset_id_fkey`
  FOREIGN KEY (`office_asset_id`) REFERENCES `office_assets`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `referrals`
  ADD COLUMN `service_request_id` VARCHAR(191) NULL;

CREATE INDEX `referrals_service_request_id_idx`
  ON `referrals`(`service_request_id`);

ALTER TABLE `referrals`
  ADD CONSTRAINT `referrals_service_request_id_fkey`
  FOREIGN KEY (`service_request_id`) REFERENCES `service_requests`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
