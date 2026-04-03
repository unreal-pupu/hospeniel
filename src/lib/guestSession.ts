const GUEST_ID_KEY = "hospineil_guest_id";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/**
 * Returns a persistent UUID for anonymous checkout. Does not touch Supabase auth.
 */
export function getOrCreateGuestId(): string {
  if (!isBrowser()) {
    return "";
  }
  try {
    const existing = window.localStorage.getItem(GUEST_ID_KEY)?.trim();
    if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)) {
      return existing;
    }
    const id = crypto.randomUUID();
    window.localStorage.setItem(GUEST_ID_KEY, id);
    return id;
  } catch {
    return "";
  }
}

export function getGuestIdIfStored(): string | null {
  if (!isBrowser()) return null;
  try {
    const v = window.localStorage.getItem(GUEST_ID_KEY)?.trim();
    if (v && /^[0-9a-f-]{36}$/i.test(v)) return v;
    return null;
  } catch {
    return null;
  }
}
