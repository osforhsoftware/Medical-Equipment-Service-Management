-- AlterEnum ServiceStatus: add finished
ALTER TABLE `service_requests` MODIFY `status` ENUM('new', 'inspection', 'estimate', 'approval', 'in-progress', 'completed', 'invoiced', 'finished') NOT NULL DEFAULT 'new';

-- AlterEnum EstimateStatus: add pending_admin_approval
ALTER TABLE `estimates` MODIFY `status` ENUM('draft', 'sent', 'pending_admin_approval', 'approved', 'rejected', 'revision') NOT NULL DEFAULT 'draft';
ALTER TABLE `estimate_revisions` MODIFY `status` ENUM('draft', 'sent', 'pending_admin_approval', 'approved', 'rejected', 'revision') NOT NULL DEFAULT 'draft';

-- Inventory commercial fields
ALTER TABLE `inventory_items`
  ADD COLUMN `description` TEXT NULL,
  ADD COLUMN `selling_price` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `delivery_charge` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `delivery_charge_type` VARCHAR(191) NOT NULL DEFAULT 'flat',
  ADD COLUMN `unit_of_measure` VARCHAR(191) NOT NULL DEFAULT 'pcs',
  ADD COLUMN `supplier_id` VARCHAR(191) NULL;

CREATE INDEX `inventory_items_supplier_id_idx` ON `inventory_items`(`supplier_id`);
ALTER TABLE `inventory_items` ADD CONSTRAINT `inventory_items_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Inventory item images
CREATE TABLE `inventory_item_images` (
  `id` VARCHAR(191) NOT NULL,
  `inventory_item_id` VARCHAR(191) NOT NULL,
  `file_id` VARCHAR(191) NOT NULL,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `inventory_item_images_inventory_item_id_file_id_key`(`inventory_item_id`, `file_id`),
  INDEX `inventory_item_images_file_id_idx`(`file_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `inventory_item_images` ADD CONSTRAINT `inventory_item_images_inventory_item_id_fkey` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inventory_item_images` ADD CONSTRAINT `inventory_item_images_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `stored_files`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Stock purchase requests
CREATE TABLE `stock_purchase_requests` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `inventory_item_id` VARCHAR(191) NOT NULL,
  `quantity` INTEGER NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'open',
  `requested_by` VARCHAR(191) NOT NULL,
  `service_request_id` VARCHAR(191) NULL,
  `job_id` VARCHAR(191) NULL,
  `purchase_order_id` VARCHAR(191) NULL,
  `note` TEXT NULL,
  `converted_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `stock_purchase_requests_tenant_id_status_idx`(`tenant_id`, `status`),
  INDEX `stock_purchase_requests_inventory_item_id_idx`(`inventory_item_id`),
  INDEX `stock_purchase_requests_service_request_id_idx`(`service_request_id`),
  INDEX `stock_purchase_requests_job_id_idx`(`job_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `stock_purchase_requests` ADD CONSTRAINT `stock_purchase_requests_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `stock_purchase_requests` ADD CONSTRAINT `stock_purchase_requests_inventory_item_id_fkey` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `stock_purchase_requests` ADD CONSTRAINT `stock_purchase_requests_service_request_id_fkey` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `stock_purchase_requests` ADD CONSTRAINT `stock_purchase_requests_job_id_fkey` FOREIGN KEY (`job_id`) REFERENCES `service_jobs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `stock_purchase_requests` ADD CONSTRAINT `stock_purchase_requests_purchase_order_id_fkey` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
