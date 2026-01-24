import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function bucketByMonth<T extends { created_at?: string | null }>(
  items: T[],
  valueFn: (item: T) => number,
  dateKey: keyof T = "created_at"
) {
  const monthly: Record<string, number> = {};
  items.forEach((item) => {
    const rawDate = item[dateKey] as string | null | undefined;
    if (!rawDate) return;
    const date = new Date(rawDate);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthly[monthKey] = (monthly[monthKey] || 0) + valueFn(item);
  });

  return Object.entries(monthly)
    .map(([month, value]) => ({ month, value }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6);
}

export async function GET(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_admin, role")
      .eq("id", authData.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const isAdmin = profile.is_admin === true || profile.role?.toLowerCase().trim() === "admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const [
      paymentsResult,
      ordersResult,
      serviceRequestsResult,
      profilesResult,
      vendorProfilesResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("payments")
        .select("total_amount, created_at, status")
        .eq("status", "success"),
      supabaseAdmin
        .from("orders")
        .select("created_at"),
      supabaseAdmin
        .from("service_requests")
        .select("amount_paid, final_price, paid_at, created_at, payment_status, status")
        .or("payment_status.eq.paid,status.eq.Paid,status.eq.Completed"),
      supabaseAdmin
        .from("profiles")
        .select("id, role, created_at, subscription_plan"),
      supabaseAdmin
        .from("profiles")
        .select("id, subscription_plan, created_at")
        .eq("role", "vendor"),
    ]);

    if (paymentsResult.error) {
      console.error("Analytics payments error:", paymentsResult.error);
    }
    if (ordersResult.error) {
      console.error("Analytics orders error:", ordersResult.error);
    }
    if (serviceRequestsResult.error) {
      console.error("Analytics service requests error:", serviceRequestsResult.error);
    }
    if (profilesResult.error) {
      console.error("Analytics profiles error:", profilesResult.error);
    }
    if (vendorProfilesResult.error) {
      console.error("Analytics vendor profiles error:", vendorProfilesResult.error);
    }

    const payments = paymentsResult.data || [];
    const orders = ordersResult.data || [];
    const serviceRequests = serviceRequestsResult.data || [];
    const profiles = profilesResult.data || [];
    const vendorProfiles = vendorProfilesResult.data || [];

    const revenueByMonth = [
      ...bucketByMonth(payments, (p) => Number(p.total_amount || 0)),
      ...bucketByMonth(
        serviceRequests.map((r) => ({
          created_at: r.paid_at || r.created_at,
          amount_paid: r.amount_paid ?? r.final_price ?? 0,
        })),
        (r) => Number(r.amount_paid || 0)
      ),
    ]
      .reduce<Record<string, number>>((acc, item) => {
        acc[item.month] = (acc[item.month] || 0) + item.value;
        return acc;
      }, {});

    const revenueByMonthData = Object.entries(revenueByMonth)
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);

    const ordersByMonthData = bucketByMonth(orders, () => 1).map((item) => ({
      month: item.month,
      orders: item.value,
    }));

    const serviceRequestsByMonthData = bucketByMonth(
      serviceRequests.map((r) => ({ created_at: r.created_at })),
      () => 1
    ).map((item) => ({
      month: item.month,
      serviceRequests: item.value,
    }));

    const userGrowthData = bucketByMonth(
      profiles.map((p) => ({ created_at: p.created_at })),
      () => 1
    ).map((item) => ({
      month: item.month,
      users: item.value,
    }));

    const subscriptionDistribution = [
      {
        plan: "Free Trial",
        count: vendorProfiles.filter((u) => u.subscription_plan === "free_trial").length,
      },
      {
        plan: "Starter",
        count: vendorProfiles.filter((u) => u.subscription_plan === "starter").length,
      },
      {
        plan: "Professional",
        count: vendorProfiles.filter((u) => u.subscription_plan === "professional").length,
      },
    ];

    const totalOrders = orders.length;
    const totalPayments = payments.length + serviceRequests.length;
    const totalServiceRequests = serviceRequests.length;
    const totalUsers = profiles.filter((p) => p.role === "user").length;
    const totalVendors = profiles.filter((p) => p.role === "vendor").length;

    return NextResponse.json({
      metrics: {
        totalOrders,
        totalPayments,
        totalServiceRequests,
        totalUsers,
        totalVendors,
      },
      revenueByMonth: revenueByMonthData,
      ordersByMonth: ordersByMonthData,
      serviceRequestsByMonth: serviceRequestsByMonthData,
      userGrowth: userGrowthData,
      subscriptionDistribution,
    });
  } catch (error) {
    console.error("Error in GET /api/admin/analytics:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
