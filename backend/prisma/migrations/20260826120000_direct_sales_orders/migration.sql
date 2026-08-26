ALTER TABLE `sales_orders` DROP FOREIGN KEY `sales_orders_estimate_id_fkey`;
ALTER TABLE `sales_orders` DROP INDEX `sales_orders_estimate_id_key`;
ALTER TABLE `sales_orders` MODIFY `estimate_id` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `sales_orders_estimate_id_key` ON `sales_orders`(`estimate_id`);
ALTER TABLE `sales_orders`
  ADD CONSTRAINT `sales_orders_estimate_id_fkey` FOREIGN KEY (`estimate_id`) REFERENCES `estimates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
