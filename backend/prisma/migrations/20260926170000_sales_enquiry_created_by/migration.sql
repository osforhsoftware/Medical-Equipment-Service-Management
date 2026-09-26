-- Own-record scoping for sales staff enquiries
ALTER TABLE `sales_enquiries` ADD COLUMN `created_by` VARCHAR(191) NULL;
CREATE INDEX `sales_enquiries_created_by_idx` ON `sales_enquiries`(`created_by`);
