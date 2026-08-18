-- Service ticket workflow v2: assignment locks, extended statuses, change requests, procurement fields
ALTER TABLE `service_requests`
  ADD COLUMN `assigned_inspector_id` VARCHAR(191) NULL,
  ADD COLUMN `assigned_engineer_id` VARCHAR(191) NULL;

CREATE INDEX `service_requests_assigned_inspector_id_idx` ON `service_requests`(`assigned_inspector_id`);
CREATE INDEX `service_requests_assigned_engineer_id_idx` ON `service_requests`(`assigned_engineer_id`);

ALTER TABLE `inspection_recommendations`
  ADD COLUMN `procurement_status` VARCHAR(191) NULL;

CREATE TABLE `service_ticket_change_requests` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,
  `service_request_id` VARCHAR(191) NOT NULL,
  `job_id` VARCHAR(191) NULL,
  `requested_by` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `description` TEXT NOT NULL,
  `items` JSON NOT NULL,
  `review_note` TEXT NULL,
  `reviewed_by` VARCHAR(191) NULL,
  `reviewed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `stcr_tenant_sr_status_idx`(`tenant_id`, `service_request_id`, `status`),
  CONSTRAINT `service_ticket_change_requests_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `service_ticket_change_requests_service_request_id_fkey` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `service_ticket_change_requests_job_id_fkey` FOREIGN KEY (`job_id`) REFERENCES `service_jobs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Extend service_requests.status enum (MySQL)
ALTER TABLE `service_requests`
  MODIFY COLUMN `status` ENUM(
    'new',
    'inspection',
    'estimate',
    'pending-approval',
    'assigned-engineer',
    'change-pending-approval',
    'pending-final-approval',
    'pending-invoice',
    'invoiced',
    'closed',
    'approval',
    'in-progress',
    'completed',
    'finished'
  ) NOT NULL DEFAULT 'new';
