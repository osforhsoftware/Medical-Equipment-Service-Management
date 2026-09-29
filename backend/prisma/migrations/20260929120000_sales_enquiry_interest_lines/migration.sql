-- Multiple products on a sales enquiry (inventory items and custom products).
ALTER TABLE `sales_enquiries`
  ADD COLUMN `interest_lines` JSON NOT NULL DEFAULT (JSON_ARRAY());
