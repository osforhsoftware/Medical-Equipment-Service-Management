-- Purchase order landed-cost fields (freight, customs, insurance)
ALTER TABLE `purchase_orders`
  ADD COLUMN `freight_cost` DECIMAL(12, 2) NULL,
  ADD COLUMN `customs_cost` DECIMAL(12, 2) NULL,
  ADD COLUMN `insurance_cost` DECIMAL(12, 2) NULL,
  ADD COLUMN `landed_cost_total` DECIMAL(12, 2) NULL;

CREATE INDEX `purchase_orders_tenant_id_status_idx` ON `purchase_orders`(`tenant_id`, `status`);
