-- Split Sales Staff from Estimate Staff (User.role enum).
ALTER TABLE `users` MODIFY `role` ENUM('admin', 'coordinator', 'inspector', 'estimator', 'sales', 'engineer', 'inventory', 'billing', 'customer') NOT NULL;
