-- Equipment Master PDF: part number, current status, purchase/sale history
ALTER TABLE `equipment`
  ADD COLUMN `part_number` VARCHAR(191) NULL AFTER `serial_number`,
  ADD COLUMN `current_status` ENUM('in_service', 'in_repair', 'in_storage', 'decommissioned', 'disposed') NOT NULL DEFAULT 'in_service' AFTER `condition`,
  ADD COLUMN `purchase_sale_history` TEXT NULL AFTER `current_status`;

CREATE INDEX `equipment_tenant_id_current_status_idx` ON `equipment`(`tenant_id`, `current_status`);
