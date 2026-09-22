-- Expense categories as tenant-managed taxonomy terms (finance operations).

ALTER TABLE `taxonomy_terms`
  MODIFY `type` ENUM(
    'equipment_category',
    'equipment_condition',
    'customer_type',
    'inventory_category',
    'inventory_subcategory',
    'expense_category'
  ) NOT NULL;
