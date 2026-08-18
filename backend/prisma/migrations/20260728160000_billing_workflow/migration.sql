-- Billing workflow: verification on jobs, invoice approval lifecycle
ALTER TABLE `service_jobs`
  ADD COLUMN `billing_verified_at` DATETIME(3) NULL,
  ADD COLUMN `billing_verified_by` VARCHAR(191) NULL,
  ADD COLUMN `completed_at` DATETIME(3) NULL;

ALTER TABLE `invoices`
  ADD COLUMN `approved_at` DATETIME(3) NULL,
  ADD COLUMN `approved_by` VARCHAR(191) NULL,
  ADD COLUMN `sent_at` DATETIME(3) NULL;

-- Extend invoice status enum
ALTER TABLE `invoices`
  MODIFY COLUMN `status` ENUM('draft', 'pendingApproval', 'approved', 'sent', 'paid', 'overdue', 'closed') NOT NULL DEFAULT 'draft';
