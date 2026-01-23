import { createClient } from "@supabase/supabase-js";

function resolveSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function resolveSupabaseAnonKey() {
  return process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export function getSupabaseClient() {
  const supabaseUrl = resolveSupabaseUrl();
  const supabaseKey = resolveSupabaseAnonKey();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("supabaseUrl and supabaseKey must be set");
  }

  return createClient(supabaseUrl, supabaseKey);
}

export function getSupabaseAdminClient() {
  const supabaseUrl = resolveSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("supabaseUrl and serviceRoleKey must be set");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "public" },
  });
}
