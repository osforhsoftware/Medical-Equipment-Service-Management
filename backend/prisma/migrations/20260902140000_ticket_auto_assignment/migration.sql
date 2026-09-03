-- Persist estimate-staff assignment separately from inspector/engineer,
-- and add tenant defaults for auto-assignment after inspection.

ALTER TABLE `service_requests`
  ADD COLUMN `assigned_estimator_id` VARCHAR(191) NULL;

CREATE INDEX `service_requests_assigned_estimator_id_idx` ON `service_requests`(`assigned_estimator_id`);

ALTER TABLE `tenant_settings`
  ADD COLUMN `auto_assign_inspector_on_create` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `auto_assign_coordinator_after_inspection` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `auto_assign_estimator_after_inspection` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `auto_assign_engineer_on_approval` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `default_coordinator_user_id` VARCHAR(191) NULL,
  ADD COLUMN `default_inspector_user_id` VARCHAR(191) NULL,
  ADD COLUMN `default_estimator_user_id` VARCHAR(191) NULL,
  ADD COLUMN `default_engineer_user_id` VARCHAR(191) NULL;
