import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";

export type EnsureAdminOk = {
  ok: true;
  userId: string;
};

export type EnsureAdminFail = {
  ok: false;
  response: NextResponse;
};

export type EnsureAdminResult = EnsureAdminOk | EnsureAdminFail;

export async function ensureAdminRequest(req: Request): Promise<EnsureAdminResult> {
  const supabaseAdmin = getSupabaseAdminClient();
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !authData?.user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("is_admin, role")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !profile) {
    return { ok: false, response: NextResponse.json({ error: "User profile not found" }, { status: 404 }) };
  }

  const isAdmin =
    profile.is_admin === true || profile.role?.toLowerCase().trim() === "admin";
  if (!isAdmin) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 }),
    };
  }

  return { ok: true, userId: authData.user.id };
}
