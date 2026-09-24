-- Explicit "no warranty" choices for machine and service warranty
ALTER TABLE `equipment`
  ADD COLUMN `no_machine_warranty` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `no_service_warranty` BOOLEAN NOT NULL DEFAULT false;
