-- Make customer type and phone optional with empty-string defaults
ALTER TABLE `customers` MODIFY `type` VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE `customers` MODIFY `phone` VARCHAR(191) NOT NULL DEFAULT '';
