-- Make customer type and phone optional with empty-string defaults
ALTER TABLE "customers" ALTER COLUMN "type" SET DEFAULT '';
ALTER TABLE "customers" ALTER COLUMN "phone" SET DEFAULT '';
