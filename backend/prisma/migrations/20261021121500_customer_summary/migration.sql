-- Short label printed on the customer copy of an estimate or invoice.
ALTER TABLE `estimates`
  ADD COLUMN `customer_summary` VARCHAR(200) NULL;

ALTER TABLE `invoices`
  ADD COLUMN `customer_summary` VARCHAR(200) NULL;
