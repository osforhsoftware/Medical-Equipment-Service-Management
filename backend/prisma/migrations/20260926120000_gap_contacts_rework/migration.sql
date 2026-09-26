-- Customer multi-contacts
CREATE TABLE `customer_contacts` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT '',
    `email` VARCHAR(191) NOT NULL DEFAULT '',
    `phone` VARCHAR(191) NOT NULL DEFAULT '',
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `customer_contacts_tenant_id_customer_id_idx` ON `customer_contacts`(`tenant_id`, `customer_id`);

ALTER TABLE `customer_contacts`
  ADD CONSTRAINT `customer_contacts_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `customer_contacts`
  ADD CONSTRAINT `customer_contacts_customer_id_fkey`
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO `customer_contacts` (`id`, `tenant_id`, `customer_id`, `name`, `role`, `email`, `phone`, `is_primary`, `created_at`, `updated_at`)
SELECT CONCAT('cc_', `id`), `tenant_id`, `id`, `contact_person`, 'Primary', `email`, `phone`, true, NOW(3), NOW(3)
FROM `customers`
WHERE TRIM(`contact_person`) <> '';

-- Rework / original job
ALTER TABLE `service_jobs`
  ADD COLUMN `original_job_id` VARCHAR(191) NULL,
  ADD COLUMN `is_rework` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `service_jobs_original_job_id_idx` ON `service_jobs`(`original_job_id`);

ALTER TABLE `service_jobs`
  ADD CONSTRAINT `service_jobs_original_job_id_fkey`
  FOREIGN KEY (`original_job_id`) REFERENCES `service_jobs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `warranty_claims`
  ADD COLUMN `original_job_id` VARCHAR(191) NULL;
