-- PO path: draft → sent → partial → closed (receipt complete).
-- Add closed, migrate legacy received → closed, then drop received from the enum.
ALTER TABLE `purchase_orders`
  MODIFY COLUMN `status` ENUM('draft', 'sent', 'received', 'partial', 'cancelled', 'closed') NOT NULL DEFAULT 'draft';

UPDATE `purchase_orders`
SET `status` = 'closed'
WHERE `status` = 'received';

ALTER TABLE `purchase_orders`
  MODIFY COLUMN `status` ENUM('draft', 'sent', 'partial', 'cancelled', 'closed') NOT NULL DEFAULT 'draft';
