export const EXPENSE_CATEGORIES = [
  "Fuel",
  "Tolls",
  "Maintenance",
  "Office",
  "Insurance",
  "Legal",
  "Software",
  "Meals",
  "Utilities",
  "Training",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
