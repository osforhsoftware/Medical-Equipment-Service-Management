-- Optional business identifier (GST, trade license, local tax ID, etc.)
ALTER TABLE `customers`
  ADD COLUMN `license_gst` VARCHAR(100) NULL;
