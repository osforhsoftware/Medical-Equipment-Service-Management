-- Warranty start date on equipment (PPT delivery/billing close)
ALTER TABLE `equipment`
  ADD COLUMN `warranty_start` DATETIME(3) NULL AFTER `install_date`;
