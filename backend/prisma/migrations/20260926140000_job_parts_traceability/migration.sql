-- AlterTable
ALTER TABLE `inventory_items` ADD COLUMN `issued` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `inventory_items` ADD COLUMN `damaged` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `stock_movements` ADD COLUMN `batch_number` VARCHAR(191) NULL;
ALTER TABLE `stock_movements` ADD COLUMN `serial_number` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `job_parts_requests` ADD COLUMN `approved_by` VARCHAR(191) NULL;
ALTER TABLE `job_parts_requests` ADD COLUMN `approved_at` DATETIME(3) NULL;
ALTER TABLE `job_parts_requests` ADD COLUMN `rejected_reason` TEXT NULL;
ALTER TABLE `job_parts_requests` ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateTable
CREATE TABLE `job_parts_request_lines` (
    `id` VARCHAR(191) NOT NULL,
    `request_id` VARCHAR(191) NOT NULL,
    `inventory_item_id` VARCHAR(191) NOT NULL,
    `item_name` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NOT NULL,
    `qty_requested` INTEGER NOT NULL,
    `qty_approved` INTEGER NOT NULL DEFAULT 0,
    `qty_issued` INTEGER NOT NULL DEFAULT 0,
    `qty_consumed` INTEGER NOT NULL DEFAULT 0,
    `qty_returned` INTEGER NOT NULL DEFAULT 0,
    `qty_scrapped` INTEGER NOT NULL DEFAULT 0,
    `unit_cost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `selling_price` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `batch_number` VARCHAR(191) NULL,
    `serial_numbers` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `job_parts_request_lines_request_id_idx`(`request_id`),
    INDEX `job_parts_request_lines_inventory_item_id_idx`(`inventory_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `job_parts_requests_status_idx` ON `job_parts_requests`(`status`);

-- AddForeignKey
ALTER TABLE `job_parts_request_lines` ADD CONSTRAINT `job_parts_request_lines_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `job_parts_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `job_parts_request_lines` ADD CONSTRAINT `job_parts_request_lines_inventory_item_id_fkey` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
