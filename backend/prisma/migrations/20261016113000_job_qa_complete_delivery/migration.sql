-- Remap current job status so operational order is QA → Complete → Delivery.
-- Activity / status-change history rows are not rewritten.
-- Old `delivery` (awaiting handoff after QA) → `completed`
-- Old `completed` (already handed off) → `delivery`

ALTER TABLE `service_jobs`
  MODIFY COLUMN `status` ENUM(
    'scheduled',
    'in-progress',
    'parts-pending',
    'review',
    'delivery',
    'completed',
    '_swap'
  ) NOT NULL DEFAULT 'scheduled';

UPDATE `service_jobs` SET `status` = '_swap' WHERE `status` = 'delivery';
UPDATE `service_jobs` SET `status` = 'delivery' WHERE `status` = 'completed';
UPDATE `service_jobs` SET `status` = 'completed' WHERE `status` = '_swap';

ALTER TABLE `service_jobs`
  MODIFY COLUMN `status` ENUM(
    'scheduled',
    'in-progress',
    'parts-pending',
    'review',
    'completed',
    'delivery'
  ) NOT NULL DEFAULT 'scheduled';
