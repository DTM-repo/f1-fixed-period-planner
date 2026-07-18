import type { DateString } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcDate(value: DateString): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUtcDate(value: Date): DateString {
  return value.toISOString().slice(0, 10);
}

export function isValidDateString(value?: string): value is DateString {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  return fromUtcDate(toUtcDate(value)) === value;
}

export function compareDates(left: DateString, right: DateString): number {
  return toUtcDate(left).getTime() - toUtcDate(right).getTime();
}

export function isAfter(left: DateString, right: DateString): boolean {
  return compareDates(left, right) > 0;
}

export function isOnOrBefore(left: DateString, right: DateString): boolean {
  return compareDates(left, right) <= 0;
}

export function maxDate(...dates: Array<DateString | undefined>): DateString | undefined {
  const validDates = dates.filter(Boolean) as DateString[];
  return validDates.sort(compareDates).at(-1);
}

export function minDate(...dates: Array<DateString | undefined>): DateString | undefined {
  const validDates = dates.filter(Boolean) as DateString[];
  return validDates.sort(compareDates).at(0);
}

export function addDays(value: DateString, days: number): DateString {
  const date = toUtcDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtcDate(date);
}

export function addYears(value: DateString, years: number): DateString {
  const date = toUtcDate(value);
  const originalMonth = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() + years);

  if (date.getUTCMonth() !== originalMonth) {
    date.setUTCDate(0);
  }

  return fromUtcDate(date);
}

export function formatDate(value?: DateString): string {
  if (!value) {
    return "unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(toUtcDate(value));
}

export function daysBetween(start: DateString, end: DateString): number {
  return Math.round((toUtcDate(end).getTime() - toUtcDate(start).getTime()) / DAY_MS);
}
