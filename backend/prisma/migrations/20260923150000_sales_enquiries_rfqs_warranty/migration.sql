-- Sales enquiries, supplier RFQs/quotes, and warranty claims
-- (models existed in schema without a corresponding migration)

CREATE TABLE IF NOT EXISTS `sales_enquiries` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `reference` VARCHAR(191) NOT NULL,
  `customer_name` VARCHAR(191) NOT NULL,
  `contact_person` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NOT NULL DEFAULT '',
  `email` VARCHAR(191) NOT NULL DEFAULT '',
  `product_interest` TEXT NOT NULL,
  `quantity` DECIMAL(12, 3) NOT NULL DEFAULT 1,
  `estimated_budget` DECIMAL(12, 2) NULL,
  `source` VARCHAR(191) NOT NULL DEFAULT '',
  `priority` VARCHAR(191) NOT NULL DEFAULT 'medium',
  `status` VARCHAR(191) NOT NULL DEFAULT 'open',
  `notes` TEXT NULL,
  `assigned_to` VARCHAR(191) NULL,
  `follow_up_date` DATETIME(3) NULL,
  `converted_estimate_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `sales_enquiries_tenant_id_reference_key`(`tenant_id`, `reference`),
  INDEX `sales_enquiries_tenant_id_status_idx`(`tenant_id`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `supplier_rfqs` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `reference` VARCHAR(191) NOT NULL,
  `supplier_id` VARCHAR(191) NULL,
  `supplier_name` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
  `notes` TEXT NULL,
  `due_date` DATETIME(3) NULL,
  `lines` JSON NOT NULL,
  `created_by` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `supplier_rfqs_tenant_id_reference_key`(`tenant_id`, `reference`),
  INDEX `supplier_rfqs_tenant_id_status_idx`(`tenant_id`, `status`),
  INDEX `supplier_rfqs_supplier_id_idx`(`supplier_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `supplier_quotes` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `rfq_id` VARCHAR(191) NOT NULL,
  `lines` JSON NOT NULL,
  `valid_until` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `supplier_quotes_tenant_id_rfq_id_idx`(`tenant_id`, `rfq_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `warranty_claims` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `reference` VARCHAR(191) NOT NULL,
  `equipment_id` VARCHAR(191) NOT NULL,
  `equipment_name` VARCHAR(191) NOT NULL,
  `customer_id` VARCHAR(191) NULL,
  `customer_name` VARCHAR(191) NOT NULL,
  `service_request_id` VARCHAR(191) NULL,
  `under_warranty` BOOLEAN NOT NULL DEFAULT false,
  `is_physical_damage` BOOLEAN NOT NULL DEFAULT false,
  `component_covered` BOOLEAN NOT NULL DEFAULT false,
  `claim_decision` VARCHAR(191) NULL,
  `inspector_notes` TEXT NULL,
  `decision_notes` TEXT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `created_by` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `warranty_claims_tenant_id_reference_key`(`tenant_id`, `reference`),
  INDEX `warranty_claims_tenant_id_status_idx`(`tenant_id`, `status`),
  INDEX `warranty_claims_equipment_id_idx`(`equipment_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `sales_enquiries`
  ADD CONSTRAINT `sales_enquiries_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `supplier_rfqs`
  ADD CONSTRAINT `supplier_rfqs_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `supplier_rfqs`
  ADD CONSTRAINT `supplier_rfqs_supplier_id_fkey`
  FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `supplier_quotes`
  ADD CONSTRAINT `supplier_quotes_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `supplier_quotes`
  ADD CONSTRAINT `supplier_quotes_rfq_id_fkey`
  FOREIGN KEY (`rfq_id`) REFERENCES `supplier_rfqs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `warranty_claims`
  ADD CONSTRAINT `warranty_claims_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
