-- Supplier master commercial fields (PDF Purchasing & Landed Cost)
ALTER TABLE `suppliers`
  ADD COLUMN `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
  ADD COLUMN `payment_terms` VARCHAR(191) NULL,
  ADD COLUMN `delivery_lead_days` INT NULL;

-- PO currency + supplier reference
ALTER TABLE `purchase_orders`
  ADD COLUMN `supplier_reference` VARCHAR(191) NULL,
  ADD COLUMN `currency` VARCHAR(191) NOT NULL DEFAULT 'INR';

-- Shipment stage (freight / courier / tracking / ETD / ETA)
CREATE TABLE `purchase_shipments` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `purchase_order_id` VARCHAR(191) NOT NULL,
  `courier` VARCHAR(191) NULL,
  `tracking_number` VARCHAR(191) NULL,
  `freight_cost` DECIMAL(12, 2) NULL,
  `customs_info` TEXT NULL,
  `etd` DATETIME(3) NULL,
  `eta` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `purchase_shipments_purchase_order_id_key`(`purchase_order_id`),
  INDEX `purchase_shipments_tenant_id_idx`(`tenant_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `purchase_shipments`
  ADD CONSTRAINT `purchase_shipments_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `purchase_shipments_purchase_order_id_fkey`
    FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
