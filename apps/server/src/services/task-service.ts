import { addDays, addWeeks, addMonths, addYears } from "date-fns";

export function calculateNextDueDate(
  currentDueDate: Date,
  recurrenceType: string,
  interval: number
): Date {
  switch (recurrenceType) {
    case "daily":
      return addDays(currentDueDate, interval);
    case "weekly":
      return addWeeks(currentDueDate, interval);
    case "monthly":
      return addMonths(currentDueDate, interval);
    case "yearly":
      return addYears(currentDueDate, interval);
    case "custom_days":
      return addDays(currentDueDate, interval);
    default:
      return addDays(currentDueDate, 1);
  }
}
