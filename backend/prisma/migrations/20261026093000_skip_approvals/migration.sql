-- Tenant-wide simple mode: skip estimate, change, final-work, and invoice approval queues.

ALTER TABLE `tenant_settings`
  ADD COLUMN `skip_approvals` BOOLEAN NOT NULL DEFAULT false;
