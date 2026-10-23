-- New organizations start with 0% tax. Existing tenant_settings rows keep their saved rate.
ALTER TABLE `tenant_settings`
  MODIFY COLUMN `default_tax_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0;
