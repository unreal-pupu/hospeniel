import type { Session, SupabaseClient } from "@supabase/supabase-js";

/**
 * Default cap for non-login paths (navbar, cart). Long enough for slow mobile,
 * still bounded so the UI never hangs forever.
 */
export const DEFAULT_AUTH_TIMEOUT_MS = 15_000;

/**
 * Login page + session restore: slow mobile networks often exceed 8s; short races
 * falsely return "no session" and break profile reads (RLS sees no JWT).
 */
export const LOGIN_AUTH_FETCH_TIMEOUT_MS = 60_000;

/**
 * After signIn, poll getSession() until tokens are visible — no Promise.race vs
 * a timer, so we never "win" with a fake empty session while the real call is still in flight.
 */
export const LOGIN_SESSION_WAIT_MAX_MS = 60_000;

type SessionResult = Awaited<ReturnType<SupabaseClient["auth"]["getSession"]>>;
type UserResult = Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>;

type AuthClient = Pick<SupabaseClient, "auth">;

/**
 * Wraps getSession() so a hung request cannot freeze first paint indefinitely.
 * On timeout, returns empty session (best-effort for non-critical paths).
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
 * Wraps getUser() for non-critical paths.
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

/**
 * Polls auth.getSession() until a session with access_token exists or maxMs elapses.
 * Use after signIn on mobile (storage/JWT can lag). Does NOT use Promise.race with a short timer.
 */
export async function waitForPersistedSession(
  client: AuthClient,
  maxMs: number = LOGIN_SESSION_WAIT_MAX_MS,
  intervalMs: number = 200
): Promise<Session | null> {
  const deadline = Date.now() + maxMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    const { data, error } = await client.auth.getSession();
    if (error) console.warn("[auth] getSession in waitForPersistedSession:", error.message);
    const session = data.session;
    if (session?.access_token) {
      if (attempt > 0) {
        console.log(`[auth] waitForPersistedSession: session ready after ${attempt} poll(s)`);
      }
      return session;
    }
    attempt += 1;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  console.warn("[auth] waitForPersistedSession: no session with access_token before deadline");
  return null;
}
