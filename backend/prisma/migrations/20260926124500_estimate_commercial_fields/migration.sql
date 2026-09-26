-- Estimate / quotation commercial rules (currency, warranty, completion).
ALTER TABLE `estimates`
  ADD COLUMN `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
  ADD COLUMN `warranty` TEXT NULL,
  ADD COLUMN `estimated_completion` DATETIME(3) NULL;
