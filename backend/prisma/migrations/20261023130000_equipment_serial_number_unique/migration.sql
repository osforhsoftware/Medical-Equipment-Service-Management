-- Enforce unique equipment serial numbers per tenant.
-- If duplicates already exist, keep the oldest row and suffix the rest so the unique index can be added.
UPDATE `equipment` e
INNER JOIN (
  SELECT
    `id`,
    ROW_NUMBER() OVER (
      PARTITION BY `tenant_id`, `serial_number`
      ORDER BY `created_at` ASC, `id` ASC
    ) AS `rn`
  FROM `equipment`
) d ON d.`id` = e.`id`
SET e.`serial_number` = CONCAT(e.`serial_number`, '-DUP-', LEFT(e.`id`, 8))
WHERE d.`rn` > 1;

CREATE UNIQUE INDEX `equipment_tenant_id_serial_number_key`
  ON `equipment`(`tenant_id`, `serial_number`);
