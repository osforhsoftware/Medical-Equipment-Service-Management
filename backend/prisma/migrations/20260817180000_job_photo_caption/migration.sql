-- Optional time/note caption for each job photo
ALTER TABLE `job_photos`
  ADD COLUMN `caption` VARCHAR(500) NULL;
