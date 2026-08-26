-- Inventory item categories/subcategories as tenant-managed taxonomy terms,
-- plus an optional parent link for hierarchical subcategories.

ALTER TABLE `taxonomy_terms`
  MODIFY `type` ENUM(
    'equipment_category',
    'equipment_condition',
    'customer_type',
    'inventory_category',
    'inventory_subcategory'
  ) NOT NULL;

ALTER TABLE `taxonomy_terms`
  ADD COLUMN `parent_id` VARCHAR(191) NULL;

CREATE INDEX `taxonomy_terms_parent_id_idx` ON `taxonomy_terms`(`parent_id`);

ALTER TABLE `taxonomy_terms`
  ADD CONSTRAINT `taxonomy_terms_parent_id_fkey`
  FOREIGN KEY (`parent_id`) REFERENCES `taxonomy_terms`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `inventory_items`
  ADD COLUMN `subcategory` VARCHAR(191) NULL;
