import type { SupabaseClient } from "@supabase/supabase-js";

export interface LoginProfileRow {
  role: string | null;
  is_admin: boolean | null;
  rider_approval_status: string | null;
  approval_status: string | null;
}

/**
 * Loads the login profile after JWT is valid. Retries for PostgREST/RLS/storage lag on mobile;
 * on first empty result calls `ensure_my_profile` RPC once (creates row if missing).
 */
export async function fetchProfileForLogin(
  supabase: SupabaseClient,
  userId: string,
  options?: { logPrefix?: string }
): Promise<{ profile: LoginProfileRow | null; error: { message: string; code?: string } | null }> {
  const prefix = options?.logPrefix ?? "[profile]";
  const maxAttempts = 15;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await supabase
      .from("profiles")
      .select("role, is_admin, rider_approval_status, approval_status")
      .eq("id", userId)
      .limit(1)
      .maybeSingle();

    if (res.error) {
      return { profile: null, error: res.error };
    }
    if (res.data) {
      return { profile: res.data as LoginProfileRow, error: null };
    }

    if (attempt === 0) {
      const { error: rpcErr } = await supabase.rpc("ensure_my_profile");
      if (rpcErr) {
        console.warn(`${prefix} ensure_my_profile:`, rpcErr.message);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 400 + attempt * 350));
  }

  return { profile: null, error: null };
}
