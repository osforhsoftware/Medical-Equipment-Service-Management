-- Invoice terms & conditions; align default currency with INR
ALTER TABLE `invoices`
  ADD COLUMN `terms` TEXT NULL;

ALTER TABLE `invoices`
  ALTER COLUMN `currency` SET DEFAULT 'INR';

-- Tenant master currency + exchange rates for multi-currency conversion
ALTER TABLE `tenant_settings`
  ADD COLUMN `master_currency` VARCHAR(10) NOT NULL DEFAULT 'INR',
  ADD COLUMN `exchange_rates` JSON NOT NULL DEFAULT (JSON_OBJECT());
