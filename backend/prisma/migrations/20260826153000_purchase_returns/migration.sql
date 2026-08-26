ALTER TABLE `purchase_order_lines`
  ADD COLUMN `quantity_returned` INTEGER NOT NULL DEFAULT 0;

CREATE TABLE `purchase_returns` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `purchase_order_id` VARCHAR(191) NOT NULL,
  `supplier_id` VARCHAR(191) NULL,
  `reference` VARCHAR(191) NOT NULL,
  `reason` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'posted',
  `returned_by` VARCHAR(191) NOT NULL,
  `returned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `items` INTEGER NOT NULL DEFAULT 0,
  `total` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `purchase_returns_tenant_id_reference_key`(`tenant_id`, `reference`),
  INDEX `purchase_returns_tenant_id_idx`(`tenant_id`),
  INDEX `purchase_returns_purchase_order_id_idx`(`purchase_order_id`),
  INDEX `purchase_returns_supplier_id_idx`(`supplier_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `purchase_return_lines` (
  `id` VARCHAR(191) NOT NULL,
  `purchase_return_id` VARCHAR(191) NOT NULL,
  `purchase_order_line_id` VARCHAR(191) NOT NULL,
  `inventory_item_id` VARCHAR(191) NOT NULL,
  `sku` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NOT NULL,
  `quantity` INTEGER NOT NULL,
  `unit_cost` DECIMAL(12, 2) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `purchase_return_lines_purchase_return_id_idx`(`purchase_return_id`),
  INDEX `purchase_return_lines_purchase_order_line_id_idx`(`purchase_order_line_id`),
  INDEX `purchase_return_lines_inventory_item_id_idx`(`inventory_item_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_purchase_order_id_fkey` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `purchase_return_lines` ADD CONSTRAINT `purchase_return_lines_purchase_return_id_fkey` FOREIGN KEY (`purchase_return_id`) REFERENCES `purchase_returns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `purchase_return_lines` ADD CONSTRAINT `purchase_return_lines_purchase_order_line_id_fkey` FOREIGN KEY (`purchase_order_line_id`) REFERENCES `purchase_order_lines`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `purchase_return_lines` ADD CONSTRAINT `purchase_return_lines_inventory_item_id_fkey` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
