-- Soft-delete / trash for inventory products (EntityStatus: active | inactive)
ALTER TABLE `inventory_items`
  ADD COLUMN `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active' AFTER `additional_fields`;

CREATE INDEX `inventory_items_tenant_id_status_idx` ON `inventory_items`(`tenant_id`, `status`);
