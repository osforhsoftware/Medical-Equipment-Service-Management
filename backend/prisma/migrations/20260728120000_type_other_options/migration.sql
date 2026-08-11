-- AlterTable
ALTER TABLE `customers` MODIFY `type` ENUM('Hospital', 'Clinic', 'Diagnostic Lab', 'Research', 'Dental', 'Other') NOT NULL;
ALTER TABLE `customers` ADD COLUMN `type_other` VARCHAR(191) NULL;

ALTER TABLE `service_requests` MODIFY `type` ENUM('Repair', 'Maintenance', 'Calibration', 'Inspection', 'Installation', 'Other') NOT NULL;
ALTER TABLE `service_requests` ADD COLUMN `type_other` VARCHAR(191) NULL;

ALTER TABLE `service_jobs` MODIFY `type` ENUM('Repair', 'Maintenance', 'Calibration', 'Inspection', 'Installation', 'Other') NOT NULL;
ALTER TABLE `service_jobs` ADD COLUMN `type_other` VARCHAR(191) NULL;
