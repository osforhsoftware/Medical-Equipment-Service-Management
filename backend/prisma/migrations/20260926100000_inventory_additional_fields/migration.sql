ALTER TABLE `inventory_items`
  ADD COLUMN `additional_fields` JSON NULL AFTER `supplier_id`;
