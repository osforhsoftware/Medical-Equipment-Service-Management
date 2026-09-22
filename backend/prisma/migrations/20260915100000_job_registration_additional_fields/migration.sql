-- Optional additional fields on job/ticket registration (PPT)
ALTER TABLE `service_requests`
  ADD COLUMN `additional_fields` JSON NULL AFTER `description`;

ALTER TABLE `service_jobs`
  ADD COLUMN `additional_fields` JSON NULL AFTER `progress`;
