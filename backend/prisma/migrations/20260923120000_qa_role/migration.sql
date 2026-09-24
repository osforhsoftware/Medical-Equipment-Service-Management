-- Add Quality Assurance staff role to User.role enum.
ALTER TABLE `users` MODIFY `role` ENUM('admin', 'coordinator', 'inspector', 'estimator', 'sales', 'engineer', 'inventory', 'billing', 'qa', 'customer') NOT NULL;
