-- Technician workbench: site/customer restrictions shown on the job.
ALTER TABLE `customers`
  ADD COLUMN `restrictions` TEXT NULL;
