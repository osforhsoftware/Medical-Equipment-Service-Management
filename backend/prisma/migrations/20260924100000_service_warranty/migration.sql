-- Separate service warranty from manufacturer/machine warranty on equipment
ALTER TABLE `equipment`
  ADD COLUMN `service_warranty_start` DATETIME(3) NULL,
  ADD COLUMN `service_warranty_end` DATETIME(3) NULL;
