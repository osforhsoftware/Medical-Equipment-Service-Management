-- Part / Item Master ERP fields
ALTER TABLE `inventory_items`
  ADD COLUMN `manufacturer` VARCHAR(191) NOT NULL DEFAULT '' AFTER `description`,
  ADD COLUMN `compatible_models` TEXT NULL AFTER `manufacturer`,
  ADD COLUMN `max_level` INT NOT NULL DEFAULT 0 AFTER `reorder_level`,
  ADD COLUMN `bin_location` VARCHAR(191) NOT NULL DEFAULT '' AFTER `max_level`,
  ADD COLUMN `track_batches` BOOLEAN NOT NULL DEFAULT false AFTER `bin_location`,
  ADD COLUMN `track_serials` BOOLEAN NOT NULL DEFAULT false AFTER `track_batches`;
