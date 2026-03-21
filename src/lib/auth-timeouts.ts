import type { SupabaseClient } from "@supabase/supabase-js";

/** Network/auth calls should not block the UI indefinitely on slow mobile connections */
export const DEFAULT_AUTH_TIMEOUT_MS = 8_000;

type SessionResult = Awaited<ReturnType<SupabaseClient["auth"]["getSession"]>>;
type UserResult = Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>;

type AuthClient = Pick<SupabaseClient, "auth">;

/**
 * Wraps getSession() so a hung request cannot freeze first paint or login flows.
 */
export async function getSessionWithTimeout(
  client: AuthClient,
  ms: number = DEFAULT_AUTH_TIMEOUT_MS
): Promise<SessionResult> {
  return Promise.race([
    client.auth.getSession(),
    new Promise<SessionResult>((resolve) =>
      setTimeout(() => {
        console.warn(`[auth] getSession timed out after ${ms}ms — continuing without session`);
        resolve({ data: { session: null }, error: null });
      }, ms)
    ),
  ]);
}

/**
 * Wraps getUser() so a hung request cannot freeze layouts, cart, or navbar.
 */
export async function getUserWithTimeout(
  client: AuthClient,
  ms: number = DEFAULT_AUTH_TIMEOUT_MS
): Promise<UserResult> {
  return Promise.race([
    client.auth.getUser(),
    new Promise<UserResult>((resolve) =>
      setTimeout(() => {
        console.warn(`[auth] getUser timed out after ${ms}ms — treating as unauthenticated`);
        resolve({ data: { user: null }, error: null } as unknown as UserResult);
      }, ms)
    ),
  ]);
}
