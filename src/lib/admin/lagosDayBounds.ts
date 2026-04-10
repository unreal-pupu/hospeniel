/** Nigeria (Lagos) calendar day in UTC instants for backend filtering. No DST. */
export const OPERATIONS_TIMEZONE = "Africa/Lagos";

export interface LagosDayBounds {
  reportDate: string;
  startUtc: string;
  endUtc: string;
}

export function getLagosDayBounds(reference: Date = new Date()): LagosDayBounds {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: OPERATIONS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(reference);
  const y = parts.find((p) => p.type === "year")!.value;
  const mo = parts.find((p) => p.type === "month")!.value;
  const da = parts.find((p) => p.type === "day")!.value;
  const dateStr = `${y}-${mo}-${da}`;
  const startUtc = new Date(`${dateStr}T00:00:00+01:00`).toISOString();
  const endUtc = new Date(`${dateStr}T23:59:59.999+01:00`).toISOString();
  return { reportDate: dateStr, startUtc, endUtc };
}
