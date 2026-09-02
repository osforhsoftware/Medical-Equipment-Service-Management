-- Add auto-generated customer reference (e.g. CUST-2026-0001)
ALTER TABLE `customers` ADD COLUMN `reference` VARCHAR(191) NULL;

UPDATE `customers` c
JOIN (
  SELECT
    `id`,
    CONCAT('CUST-', YEAR(`created_at`), '-', LPAD(ROW_NUMBER() OVER (PARTITION BY `tenant_id` ORDER BY `created_at`), 4, '0')) AS `ref`
  FROM `customers`
) ranked ON c.`id` = ranked.`id`
SET c.`reference` = ranked.`ref`;

ALTER TABLE `customers` MODIFY `reference` VARCHAR(191) NOT NULL;

CREATE UNIQUE INDEX `customers_tenant_id_reference_key` ON `customers`(`tenant_id`, `reference`);
