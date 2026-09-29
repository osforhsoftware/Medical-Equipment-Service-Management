-- Commercial terms requested from the supplier on an RFQ
ALTER TABLE `supplier_rfqs`
  ADD COLUMN `currency` VARCHAR(10) NULL DEFAULT 'INR',
  ADD COLUMN `warranty` VARCHAR(500) NULL,
  ADD COLUMN `incoterm` VARCHAR(100) NULL,
  ADD COLUMN `shipping_terms` VARCHAR(500) NULL,
  ADD COLUMN `payment_terms` VARCHAR(500) NULL,
  ADD COLUMN `country_of_origin` VARCHAR(100) NULL,
  ADD COLUMN `valid_until` DATETIME(3) NULL;
