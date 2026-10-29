const UTC_DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const UTC_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function parse(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Stable UTC formatting avoids server/client hydration differences. */
export function formatUtc(value: string | null | undefined): string {
  if (!value) return "—";
  const date = parse(value);
  if (!date) return "Invalid date";
  return `${UTC_DATE_TIME.format(date)} UTC`;
}

export function formatDateUtc(value: string | null | undefined): string {
  if (!value) return "—";
  const date = parse(value);
  if (!date) return "Invalid date";
  return UTC_DATE.format(date);
}

export function shortIndicator(value: string, max = 72): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

export function humanizeToken(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

export function safeFilename(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
