import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { ensureAdminRequest } from "@/lib/admin/ensureAdminRequest";
import { getLagosDayBounds } from "@/lib/admin/lagosDayBounds";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const authResult = await ensureAdminRequest(req);
    if (!authResult.ok) return authResult.response;

    const bounds = getLagosDayBounds();

    const [
      userCountResult,
      vendorCountResult,
      activeOrdersResult,
      paymentsResult,
      serviceRequestsResult,
      pendingPayoutsResult,
      subscriptionsResult,
      pendingNewToday,
      acceptedNewToday,
      outForDeliveryNow,
      deliveredToday,
      vendorsOpenCount,
      vendorsClosedCount,
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
      supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .gte("created_at", bounds.startUtc)
        .lte("created_at", bounds.endUtc)
        .in("status", ["Pending", "Paid"]),
      supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .gte("created_at", bounds.startUtc)
        .lte("created_at", bounds.endUtc)
        .in("status", ["Accepted", "Confirmed"]),
      supabaseAdmin
        .from("delivery_tasks")
        .select("id", { count: "exact", head: true })
        .in("status", ["Assigned", "PickedUp"]),
      supabaseAdmin
        .from("delivery_tasks")
        .select("id", { count: "exact", head: true })
        .eq("status", "Delivered")
        .gte("delivered_at", bounds.startUtc)
        .lte("delivered_at", bounds.endUtc),
      supabaseAdmin
        .from("vendors")
        .select("profile_id", { count: "exact", head: true })
        .or("is_open.is.null,is_open.eq.true"),
      supabaseAdmin.from("vendors").select("profile_id", { count: "exact", head: true }).eq("is_open", false),
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
      dailyOperations: {
        reportDate: bounds.reportDate,
        timezone: "Africa/Lagos",
        /** Orders placed today still in Pending / Paid */
        pendingNewToday: pendingNewToday.count || 0,
        /** Orders placed today in Accepted / Confirmed */
        acceptedNewToday: acceptedNewToday.count || 0,
        /** Live pipeline: delivery tasks currently Assigned or PickedUp */
        outForDeliveryNow: outForDeliveryNow.count || 0,
        /** Tasks marked Delivered today (Lagos calendar day) */
        deliveredToday: deliveredToday.count || 0,
        description:
          "Pending and Accepted counts are for orders created today. Out for delivery is the current open delivery pipeline. Delivered counts completed tasks today.",
      },
      vendorAvailability: {
        open: vendorsOpenCount.count || 0,
        closed: vendorsClosedCount.count || 0,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/admin/dashboard:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
