import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const COMMISSION_RATE = 0.10;

async function ensureAdmin(req: Request) {
  const supabaseAdmin = getSupabaseAdminClient();
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !authData?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("is_admin, role")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !profile) {
    return { error: NextResponse.json({ error: "User profile not found" }, { status: 404 }) };
  }

  const isAdmin = profile.is_admin === true || profile.role?.toLowerCase().trim() === "admin";
  if (!isAdmin) {
    return { error: NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 }) };
  }

  return { userId: authData.user.id };
}

export async function GET(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const authResult = await ensureAdmin(req);
    if ("error" in authResult) return authResult.error;

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("total_price, status")
      .in("status", ["Completed", "Paid"]);

    if (ordersError) {
      console.error("Error fetching commission summary:", ordersError);
      return NextResponse.json({ error: "Failed to fetch commission summary" }, { status: 500 });
    }

    const totalRevenue = (orders || []).reduce(
      (sum, order) => sum + (Number(order.total_price) || 0),
      0
    );
    const totalCommission = totalRevenue * COMMISSION_RATE;

    return NextResponse.json({
      totalCommission,
      totalOrders: orders?.length || 0,
      totalRevenue,
      commissionRate: COMMISSION_RATE,
    });
  } catch (error) {
    console.error("Error in GET /api/admin/commission-summary:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
