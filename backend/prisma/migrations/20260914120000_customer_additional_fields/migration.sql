-- Customer Master: PPT commercial fields + configurable additional fields
ALTER TABLE `customers`
  ADD COLUMN `payment_terms` VARCHAR(191) NULL,
  ADD COLUMN `credit_limit` DECIMAL(12, 2) NULL,
  ADD COLUMN `price_category` VARCHAR(191) NULL,
  ADD COLUMN `delivery_address` VARCHAR(500) NULL,
  ADD COLUMN `additional_fields` JSON NULL;
