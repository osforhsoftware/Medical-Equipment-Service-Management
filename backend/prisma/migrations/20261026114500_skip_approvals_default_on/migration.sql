-- Skip approvals is on by default for every tenant / user.

ALTER TABLE `tenant_settings`
  MODIFY COLUMN `skip_approvals` BOOLEAN NOT NULL DEFAULT true;

UPDATE `tenant_settings`
  SET `skip_approvals` = true;
