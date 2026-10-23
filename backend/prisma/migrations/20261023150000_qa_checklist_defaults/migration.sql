-- Default QA checklist points (tenant-configurable). Empty JSON uses app defaults.
ALTER TABLE `tenant_settings`
  ADD COLUMN `qa_checklist_defaults` JSON NOT NULL DEFAULT (JSON_ARRAY());
