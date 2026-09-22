-- Repair → QA → Delivery workflow: add delivery status + stage details JSON
ALTER TABLE `service_jobs`
  MODIFY COLUMN `status` ENUM(
    'scheduled',
    'in-progress',
    'parts-pending',
    'review',
    'delivery',
    'completed'
  ) NOT NULL DEFAULT 'scheduled';

ALTER TABLE `service_jobs`
  ADD COLUMN `stage_details` JSON NULL;