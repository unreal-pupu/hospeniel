import type { SupabaseClient } from "@supabase/supabase-js";

/** Must match {@link ../lib/supabaseClient} `auth.storageKey`. */
const BROWSER_AUTH_STORAGE_KEY = "hospineil-auth";

/**
 * Abandoned Google OAuth leaves `${storageKey}-code-verifier` in cookie storage.
 * With `detectSessionInUrl: true` (forced by @supabase/ssr), any later URL with `?code=`
 * is treated as PKCE completion — wrong for email/password users.
 *
 * Clear the verifier when starting email/password login so password flow cannot pair with stale OAuth state.
 */
export async function clearPkceVerifierFromClient(client: SupabaseClient): Promise<void> {
  const verifierKey = `${BROWSER_AUTH_STORAGE_KEY}-code-verifier`;
  try {
    const storage = (client.auth as unknown as { storage?: { removeItem: (key: string) => Promise<void> } })
      .storage;
    if (storage?.removeItem) {
      await storage.removeItem(verifierKey);
      console.log(
        "[login][email/password] Cleared stale OAuth PKCE code-verifier (prevents password login from being handled as OAuth)"
      );
    }
  } catch (e) {
    console.warn("[login][email/password] clearPkceVerifierFromClient:", e);
  }
}
