import { AppError } from "@/middleware/errorHandler";

/**
 * Parse a calendar day without shifting it across timezones.
 * `YYYY-MM-DD` is stored at local noon so UTC conversion still lands on the same day.
 */
export function parseCalendarDate(value: unknown): Date {
  try {
    return parseCalendarDateValue(value);
  } catch {
    throw new AppError("Enter a valid date", 422);
  }
}

function parseCalendarDateValue(value: unknown): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error("Invalid date");
    return value;
  }

  const raw = String(value ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) {
    const parsed = new Date(raw);
    if (!raw || Number.isNaN(parsed.getTime())) throw new Error("Invalid date");
    return parsed;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error("Invalid date");
  }
  return date;
}
