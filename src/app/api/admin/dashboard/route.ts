import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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

    const [
      userCountResult,
      vendorCountResult,
      activeOrdersResult,
      paymentsResult,
      serviceRequestsResult,
      pendingPayoutsResult,
      subscriptionsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .neq("role", "vendor")
        .neq("is_admin", true),
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "vendor"),
      supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["Pending", "Paid", "Confirmed", "Accepted"]),
      supabaseAdmin
        .from("payments")
        .select("total_amount, commission_amount")
        .eq("status", "success"),
      supabaseAdmin
        .from("service_requests")
        .select("amount_paid, final_price, payment_status, status")
        .or("payment_status.eq.paid,status.eq.Paid,status.eq.Completed"),
      supabaseAdmin
        .from("vendor_payouts")
        .select("payout_amount")
        .eq("status", "pending"),
      supabaseAdmin
        .from("profiles")
        .select("subscription_plan")
        .eq("role", "vendor"),
    ]);

    const paymentRevenue = (paymentsResult.data || []).reduce(
      (sum, p) => sum + (Number(p.total_amount) || 0),
      0
    );
    const serviceRevenue = (serviceRequestsResult.data || []).reduce(
      (sum, r) => sum + (Number(r.amount_paid ?? r.final_price) || 0),
      0
    );

    const totalRevenue = paymentRevenue + serviceRevenue;
    const totalCommission = (paymentsResult.data || []).reduce(
      (sum, p) => sum + (Number(p.commission_amount) || 0),
      0
    );

    const pendingPayouts = (pendingPayoutsResult.data || []).reduce(
      (sum, p) => sum + (Number(p.payout_amount) || 0),
      0
    );

    const freeTrialVendors = (subscriptionsResult.data || []).filter(
      (p) => p.subscription_plan === "free_trial"
    ).length;

    const professionalVendors = (subscriptionsResult.data || []).filter(
      (p) => p.subscription_plan === "professional"
    ).length;

    return NextResponse.json({
      totalUsers: userCountResult.count || 0,
      totalVendors: vendorCountResult.count || 0,
      activeOrders: activeOrdersResult.count || 0,
      totalRevenue,
      totalCommission,
      pendingPayouts,
      freeTrialVendors,
      professionalVendors,
    });
  } catch (error) {
    console.error("Error in GET /api/admin/dashboard:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
