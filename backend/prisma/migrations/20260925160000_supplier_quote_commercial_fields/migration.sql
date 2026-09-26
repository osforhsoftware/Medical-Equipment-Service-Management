-- Supplier quote commercial fields required when recording an RFQ response
ALTER TABLE `supplier_quotes`
  ADD COLUMN `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
  ADD COLUMN `warranty` VARCHAR(191) NULL,
  ADD COLUMN `incoterm` VARCHAR(191) NULL,
  ADD COLUMN `shipping_terms` VARCHAR(191) NULL,
  ADD COLUMN `payment_terms` VARCHAR(191) NULL,
  ADD COLUMN `country_of_origin` VARCHAR(191) NULL;
