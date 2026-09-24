-- Add terminal `cancelled` status to ServiceRequest.status enum (return-without-repair).
ALTER TABLE `service_requests` MODIFY `status` ENUM('new', 'inspection', 'estimate', 'pending-approval', 'assigned-engineer', 'change-pending-approval', 'pending-final-approval', 'pending-invoice', 'invoiced', 'closed', 'cancelled', 'approval', 'in-progress', 'completed', 'finished') NOT NULL DEFAULT 'new';
