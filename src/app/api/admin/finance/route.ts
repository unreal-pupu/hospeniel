import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    // TODO: Add admin authentication check here
    // For now, this endpoint is accessible - add proper admin role check in production

    // Get total platform revenue (sum of commissions)
    const { data: commissionData, error: commissionError } = await supabaseAdmin
      .from("payments")
      .select("commission_amount")
      .eq("status", "success");

    if (commissionError) {
      console.error("Error fetching commission data:", commissionError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch commission data" },
        { status: 500 }
      );
    }

    const totalCommission = (commissionData || []).reduce(
      (sum, payment) => sum + (Number(payment.commission_amount) || 0),
      0
    );

    // Get total taxes collected
    const { data: taxData, error: taxError } = await supabaseAdmin
      .from("payments")
      .select("tax_amount")
      .eq("status", "success");

    if (taxError) {
      console.error("Error fetching tax data:", taxError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch tax data" },
        { status: 500 }
      );
    }

    const totalTax = (taxData || []).reduce(
      (sum, payment) => sum + (Number(payment.tax_amount) || 0),
      0
    );

    // Get pending payouts
    const { data: pendingPayouts, error: pendingError } = await supabaseAdmin
      .from("vendor_payouts")
      .select("payout_amount")
      .eq("status", "pending");

    if (pendingError) {
      console.error("Error fetching pending payouts:", pendingError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch pending payouts" },
        { status: 500 }
      );
    }

    const totalPendingPayouts = (pendingPayouts || []).reduce(
      (sum, payout) => sum + (Number(payout.payout_amount) || 0),
      0
    );

    // Get completed payouts
    const { data: completedPayouts, error: completedError } = await supabaseAdmin
      .from("vendor_payouts")
      .select("payout_amount")
      .eq("status", "completed");

    if (completedError) {
      console.error("Error fetching completed payouts:", completedError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch completed payouts" },
        { status: 500 }
      );
    }

    const totalCompletedPayouts = (completedPayouts || []).reduce(
      (sum, payout) => sum + (Number(payout.payout_amount) || 0),
      0
    );

    // Get total revenue (sum of all successful payments)
    const { data: revenueData, error: revenueError } = await supabaseAdmin
      .from("payments")
      .select("total_amount")
      .eq("status", "success");

    if (revenueError) {
      console.error("Error fetching revenue data:", revenueError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch revenue data" },
        { status: 500 }
      );
    }

    const totalRevenue = (revenueData || []).reduce(
      (sum, payment) => sum + (Number(payment.total_amount) || 0),
      0
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalCommission: Math.round(totalCommission * 100) / 100,
          totalTax: Math.round(totalTax * 100) / 100,
          totalPendingPayouts: Math.round(totalPendingPayouts * 100) / 100,
          totalCompletedPayouts: Math.round(totalCompletedPayouts * 100) / 100,
          netPlatformRevenue: Math.round((totalCommission - totalPendingPayouts) * 100) / 100,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Finance API error:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}





