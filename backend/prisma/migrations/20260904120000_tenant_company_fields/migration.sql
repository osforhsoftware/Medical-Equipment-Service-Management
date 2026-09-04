-- Add company contact fields used on documents and settings
ALTER TABLE `tenant_settings`
  ADD COLUMN `company_address` VARCHAR(500) NULL,
  ADD COLUMN `company_phone` VARCHAR(40) NULL,
  ADD COLUMN `company_website` VARCHAR(200) NULL;
