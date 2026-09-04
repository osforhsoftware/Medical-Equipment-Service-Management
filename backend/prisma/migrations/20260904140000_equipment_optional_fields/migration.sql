-- Allow equipment registration with fewer required fields
ALTER TABLE `equipment` MODIFY `model` VARCHAR(191) NOT NULL DEFAULT '';
ALTER TABLE `equipment` MODIFY `manufacturer` VARCHAR(191) NOT NULL DEFAULT '';
ALTER TABLE `equipment` MODIFY `category` VARCHAR(191) NOT NULL DEFAULT '';
ALTER TABLE `equipment` MODIFY `customer_id` VARCHAR(191) NULL;
ALTER TABLE `equipment` MODIFY `customer_name` VARCHAR(191) NOT NULL DEFAULT '';
ALTER TABLE `equipment` MODIFY `location` VARCHAR(191) NOT NULL DEFAULT '';
ALTER TABLE `equipment` MODIFY `install_date` DATETIME(3) NULL;
ALTER TABLE `equipment` MODIFY `warranty_end` DATETIME(3) NULL;
