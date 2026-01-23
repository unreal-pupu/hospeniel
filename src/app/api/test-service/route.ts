// app/api/test-service/route.ts
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("users").select("*").limit(1);
  return NextResponse.json({ data, error });
}
