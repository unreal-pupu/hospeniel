import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";

export interface AuthenticatedRequestContext {
  userId: string;
  role: string | null;
  isAdmin: boolean;
}

type EnsureAuthOk = {
  ok: true;
  context: AuthenticatedRequestContext;
};

type EnsureAuthFail = {
  ok: false;
  response: NextResponse;
};

export type EnsureAuthenticatedRequestResult = EnsureAuthOk | EnsureAuthFail;

export async function ensureAuthenticatedRequest(
  req: Request
): Promise<EnsureAuthenticatedRequestResult> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role, is_admin")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Failed to verify user profile" }, { status: 500 }),
    };
  }

  const normalizedRole = profile?.role?.toLowerCase().trim() ?? null;
  const isAdmin = profile?.is_admin === true || normalizedRole === "admin";

  return {
    ok: true,
    context: {
      userId: authData.user.id,
      role: normalizedRole,
      isAdmin,
    },
  };
}
