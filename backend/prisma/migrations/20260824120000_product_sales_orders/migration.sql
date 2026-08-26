ALTER TABLE `estimates`
  ADD COLUMN `salesperson_id` VARCHAR(191) NULL;

ALTER TABLE `estimates`
  MODIFY `status` ENUM(
    'draft',
    'sent',
    'pending_admin_approval',
    'approved',
    'rejected',
    'revision',
    'converted'
  ) NOT NULL DEFAULT 'draft';

CREATE TABLE `sales_orders` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `estimate_id` VARCHAR(191) NOT NULL,
  `customer_id` VARCHAR(191) NOT NULL,
  `salesperson_id` VARCHAR(191) NULL,
  `branch_id` VARCHAR(191) NULL,
  `reference` VARCHAR(191) NOT NULL,
  `customer_name` VARCHAR(191) NOT NULL,
  `salesperson_name` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'confirmed',
  `delivery_status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `payment_status` VARCHAR(191) NOT NULL DEFAULT 'unpaid',
  `subtotal` DECIMAL(12, 2) NOT NULL,
  `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `tax` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `total` DECIMAL(12, 2) NOT NULL,
  `notes` TEXT NULL,
  `ordered_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `delivered_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `sales_orders_estimate_id_key`(`estimate_id`),
  UNIQUE INDEX `sales_orders_tenant_id_reference_key`(`tenant_id`, `reference`),
  INDEX `sales_orders_tenant_id_status_idx`(`tenant_id`, `status`),
  INDEX `sales_orders_customer_id_idx`(`customer_id`),
  INDEX `sales_orders_salesperson_id_idx`(`salesperson_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `sales_orders`
  ADD CONSTRAINT `sales_orders_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `sales_orders`
  ADD CONSTRAINT `sales_orders_estimate_id_fkey` FOREIGN KEY (`estimate_id`) REFERENCES `estimates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `sales_orders`
  ADD CONSTRAINT `sales_orders_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `sales_order_lines` (
  `id` VARCHAR(191) NOT NULL,
  `sales_order_id` VARCHAR(191) NOT NULL,
  `inventory_item_id` VARCHAR(191) NULL,
  `catalog_item_id` VARCHAR(191) NULL,
  `type` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NOT NULL,
  `sku` VARCHAR(191) NULL,
  `quantity` DECIMAL(12, 3) NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(12, 2) NOT NULL,
  `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `tax_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
  `line_total` DECIMAL(12, 2) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `sales_order_lines_sales_order_id_idx`(`sales_order_id`),
  INDEX `sales_order_lines_inventory_item_id_idx`(`inventory_item_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `sales_order_lines`
  ADD CONSTRAINT `sales_order_lines_sales_order_id_fkey` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `sales_order_lines`
  ADD CONSTRAINT `sales_order_lines_inventory_item_id_fkey` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `stock_reservations`
  ADD COLUMN `sales_order_id` VARCHAR(191) NULL;
CREATE INDEX `stock_reservations_sales_order_id_idx` ON `stock_reservations`(`sales_order_id`);
ALTER TABLE `stock_reservations`
  ADD CONSTRAINT `stock_reservations_sales_order_id_fkey` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `invoices`
  ADD COLUMN `sales_order_id` VARCHAR(191) NULL;
CREATE INDEX `invoices_sales_order_id_idx` ON `invoices`(`sales_order_id`);
ALTER TABLE `invoices`
  ADD CONSTRAINT `invoices_sales_order_id_fkey` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `commissions`
  ADD COLUMN `sales_order_id` VARCHAR(191) NULL;
ALTER TABLE `commissions`
  ADD CONSTRAINT `commissions_sales_order_id_fkey` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
