-- After adding a customer, optionally walk staff through equipment
-- registration and a first service ticket. Admins can turn this off.

ALTER TABLE `tenant_settings`
  ADD COLUMN `guided_setup_flow` BOOLEAN NOT NULL DEFAULT true;
