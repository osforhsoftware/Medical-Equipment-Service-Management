-- Remember taxonomy slugs a tenant deleted so default lists are not recreated.

CREATE TABLE `taxonomy_suppressions` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `type` ENUM(
        'equipment_category',
        'equipment_condition',
        'customer_type',
        'inventory_category',
        'inventory_subcategory',
        'expense_category'
    ) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `taxonomy_suppressions_tenant_id_type_slug_key`(`tenant_id`, `type`, `slug`),
    INDEX `taxonomy_suppressions_tenant_id_type_idx`(`tenant_id`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `taxonomy_suppressions`
    ADD CONSTRAINT `taxonomy_suppressions_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
