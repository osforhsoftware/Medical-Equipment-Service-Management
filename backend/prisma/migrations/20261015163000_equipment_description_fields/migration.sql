-- Equipment registration: part description and additional note
ALTER TABLE `equipment`
  ADD COLUMN `part_description` TEXT NULL AFTER `part_number`,
  ADD COLUMN `additional_note` TEXT NULL AFTER `part_description`;
