-- PPT: Spare Parts vs Consumables business class on Part/Item Master
ALTER TABLE `inventory_items`
  ADD COLUMN `item_class` VARCHAR(32) NOT NULL DEFAULT 'spare_part' AFTER `name`;

CREATE INDEX `inventory_items_tenant_id_item_class_idx` ON `inventory_items`(`tenant_id`, `item_class`);

-- Map existing Consumables taxonomy to consumable; everything else stays spare_part
UPDATE `inventory_items`
SET `item_class` = 'consumable'
WHERE LOWER(`category`) IN ('consumables', 'consumable')
   OR LOWER(`category`) LIKE '%consumable%';
