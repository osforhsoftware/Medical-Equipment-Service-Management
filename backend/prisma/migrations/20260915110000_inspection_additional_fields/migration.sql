-- Optional additional fields on inspection reports (PPT)
ALTER TABLE `inspection_reports`
  ADD COLUMN `additional_fields` JSON NULL AFTER `technician_remarks`;
