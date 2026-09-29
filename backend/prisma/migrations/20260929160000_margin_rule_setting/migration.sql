-- Admin margin rule: off, fixed percent, or on (dynamic per item selling price).

ALTER TABLE `tenant_settings`
  ADD COLUMN `margin_mode` VARCHAR(16) NOT NULL DEFAULT 'fixed',
  ADD COLUMN `min_margin_pct` DECIMAL(5, 2) NOT NULL DEFAULT 20.00;
