-- Allow service tickets to be created without a service type
ALTER TABLE `service_requests`
  MODIFY `type` ENUM('Repair', 'Maintenance', 'Calibration', 'Inspection', 'Installation', 'Other') NULL;
