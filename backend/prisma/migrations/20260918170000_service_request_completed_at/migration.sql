-- Soft-archive marker: tickets in the board "Completed" bucket older than 7 days hide from active views.
ALTER TABLE `service_requests` ADD COLUMN `completed_at` DATETIME(3) NULL;

-- Backfill from last update for tickets already in completed/billing/closed states.
UPDATE `service_requests`
SET `completed_at` = `updated_at`
WHERE `status` IN ('completed', 'pending_invoice', 'invoiced', 'closed', 'finished')
  AND `completed_at` IS NULL;

CREATE INDEX `service_requests_tenant_id_completed_at_idx` ON `service_requests`(`tenant_id`, `completed_at`);
