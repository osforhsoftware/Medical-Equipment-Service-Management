-- Site address fields on customers
ALTER TABLE `customers`
  ADD COLUMN `address` VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN `country` VARCHAR(100) NOT NULL DEFAULT '';

-- Allow dynamic customer types (free-text) instead of fixed enum
ALTER TABLE `customers` MODIFY `type` VARCHAR(100) NOT NULL;

-- Normalize Prisma enum mapped value to app key
UPDATE `customers`
SET `type` = 'DiagnosticLab'
WHERE `type` = 'Diagnostic Lab';

-- Promote legacy "Other" free-text into the type column
UPDATE `customers`
SET `type` = `type_other`
WHERE `type` = 'Other'
  AND `type_other` IS NOT NULL
  AND TRIM(`type_other`) <> '';
