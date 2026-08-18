-- Tenant-managed lookup lists (equipment category/condition, customer type)
-- plus Equipment.condition ENUM → VARCHAR so custom condition slugs can be stored.

CREATE TABLE `taxonomy_terms` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `type` ENUM('equipment_category', 'equipment_condition', 'customer_type') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `taxonomy_terms_tenant_id_type_slug_key`(`tenant_id`, `type`, `slug`),
    UNIQUE INDEX `taxonomy_terms_tenant_id_type_name_key`(`tenant_id`, `type`, `name`),
    INDEX `taxonomy_terms_tenant_id_type_is_active_idx`(`tenant_id`, `type`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `taxonomy_terms`
  ADD CONSTRAINT `taxonomy_terms_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `equipment`
  MODIFY `condition` VARCHAR(80) NOT NULL DEFAULT 'operational';

UPDATE `equipment` SET `condition` = 'needsService' WHERE `condition` = 'needs-service';

UPDATE `equipment` SET `category` = 'imaging' WHERE `category` = 'Imaging';
UPDATE `equipment` SET `category` = 'life-support' WHERE `category` = 'Life Support';
UPDATE `equipment` SET `category` = 'diagnostics' WHERE `category` = 'Diagnostics';
UPDATE `equipment` SET `category` = 'laboratory' WHERE `category` = 'Laboratory';
UPDATE `equipment` SET `category` = 'surgical' WHERE `category` = 'Surgical';
UPDATE `equipment` SET `category` = 'monitoring' WHERE `category` = 'Monitoring';
UPDATE `equipment` SET `category` = 'other' WHERE `category` = 'Other';

INSERT INTO `taxonomy_terms` (
  `id`, `tenant_id`, `type`, `name`, `slug`, `sort_order`, `is_active`, `is_system`, `created_at`, `updated_at`
)
SELECT
  CONCAT('tax_', REPLACE(UUID(), '-', ''), '_', d.slug),
  t.id,
  d.type,
  d.name,
  d.slug,
  d.sort_order,
  1,
  1,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM `tenants` t
CROSS JOIN (
  SELECT 'equipment_category' AS type, 'Imaging' AS name, 'imaging' AS slug, 10 AS sort_order
  UNION ALL SELECT 'equipment_category', 'Life Support', 'life-support', 20
  UNION ALL SELECT 'equipment_category', 'Diagnostics', 'diagnostics', 30
  UNION ALL SELECT 'equipment_category', 'Laboratory', 'laboratory', 40
  UNION ALL SELECT 'equipment_category', 'Surgical', 'surgical', 50
  UNION ALL SELECT 'equipment_category', 'Monitoring', 'monitoring', 60
  UNION ALL SELECT 'equipment_category', 'Other', 'other', 70
  UNION ALL SELECT 'equipment_condition', 'Operational', 'operational', 10
  UNION ALL SELECT 'equipment_condition', 'Needs Service', 'needsService', 20
  UNION ALL SELECT 'equipment_condition', 'Down', 'down', 30
  UNION ALL SELECT 'customer_type', 'Hospital', 'Hospital', 10
  UNION ALL SELECT 'customer_type', 'Clinic', 'Clinic', 20
  UNION ALL SELECT 'customer_type', 'Diagnostic Lab', 'DiagnosticLab', 30
  UNION ALL SELECT 'customer_type', 'Research', 'Research', 40
  UNION ALL SELECT 'customer_type', 'Dental', 'Dental', 50
  UNION ALL SELECT 'customer_type', 'Other', 'Other', 60
) d
WHERE NOT EXISTS (
  SELECT 1 FROM `taxonomy_terms` x
  WHERE x.tenant_id = t.id AND x.type = d.type AND x.slug = d.slug
);
