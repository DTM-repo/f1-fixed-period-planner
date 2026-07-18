import type { DateString } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12
};

export interface DateNormalizationResult {
  value?: DateString;
  normalized: boolean;
  issue?: "ambiguous" | "invalid";
}

function toUtcDate(value: DateString): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUtcDate(value: Date): DateString {
  return value.toISOString().slice(0, 10);
}

export function isValidDateString(value?: string): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  return fromUtcDate(toUtcDate(value)) === value;
}

function canonicalDate(year: number, month: number, day: number): DateString | undefined {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return undefined;
  }
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) {
    return undefined;
  }

  const value = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;
  return isValidDateString(value) ? value : undefined;
}

export function normalizeDateInput(value?: string): DateNormalizationResult {
  const trimmed = value?.trim();
  if (!trimmed) {
    return { normalized: false };
  }

  if (isValidDateString(trimmed)) {
    return { value: trimmed, normalized: false };
  }

  const isoLike = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoLike) {
    const normalized = canonicalDate(Number(isoLike[1]), Number(isoLike[2]), Number(isoLike[3]));
    return normalized ? { value: normalized, normalized: true } : { normalized: false, issue: "invalid" };
  }

  const compact = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    const normalized = canonicalDate(Number(compact[1]), Number(compact[2]), Number(compact[3]));
    return normalized ? { value: normalized, normalized: true } : { normalized: false, issue: "invalid" };
  }

  const monthNameFirst = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/);
  if (monthNameFirst) {
    const month = MONTHS[monthNameFirst[1].toLowerCase()];
    const normalized = canonicalDate(Number(monthNameFirst[3]), month, Number(monthNameFirst[2]));
    return normalized ? { value: normalized, normalized: true } : { normalized: false, issue: "invalid" };
  }

  const dayFirstMonthName = trimmed.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(\d{4})$/);
  if (dayFirstMonthName) {
    const month = MONTHS[dayFirstMonthName[2].toLowerCase()];
    const normalized = canonicalDate(Number(dayFirstMonthName[3]), month, Number(dayFirstMonthName[1]));
    return normalized ? { value: normalized, normalized: true } : { normalized: false, issue: "invalid" };
  }

  const numeric = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const year = Number(numeric[3]);

    if (first <= 12 && second <= 12) {
      return { normalized: false, issue: "ambiguous" };
    }

    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    const normalized = canonicalDate(year, month, day);
    return normalized ? { value: normalized, normalized: true } : { normalized: false, issue: "invalid" };
  }

  return { normalized: false, issue: "invalid" };
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
