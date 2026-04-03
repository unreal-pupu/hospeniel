const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidGuestId(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  return UUID_RE.test(value.trim());
}

/** Nigeria-oriented: require at least 10 digits after stripping non-digits */
export function isValidCheckoutPhone(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10;
}

export function normalizeCheckoutPhone(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidCustomerName(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  return value.trim().length >= 2;
}
