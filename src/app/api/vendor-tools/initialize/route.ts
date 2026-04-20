import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { ensureAuthenticatedRequest } from "@/lib/api/ensureAuthenticatedRequest";
import {
  getExpectedToolPriceKobo,
  isValidPremiumToolName,
  type VendorToolBilling,
} from "@/lib/vendor-premium-tools-catalog";

export async function POST(req: Request) {
  try {
    const authCheck = await ensureAuthenticatedRequest(req);
    if (!authCheck.ok) return authCheck.response;

    const body = (await req.json()) as {
      userId?: string;
      toolName?: string;
      billing?: VendorToolBilling;
    };
    const userId =
      authCheck.context.isAdmin && body.userId ? body.userId : authCheck.context.userId;
    const toolName = body.toolName;
    const billing = body.billing === "yearly" ? "yearly" : "monthly";

    if (!userId || !toolName) {
      return NextResponse.json(
        { success: false, error: "userId and toolName are required" },
        { status: 400 }
      );
    }

    if (!isValidPremiumToolName(toolName)) {
      return NextResponse.json(
        { success: false, error: "Invalid premium tool selected" },
        { status: 400 }
      );
    }

    const amountKobo = getExpectedToolPriceKobo(toolName, billing);
    if (!amountKobo) {
      return NextResponse.json(
        { success: false, error: "Unable to resolve payment amount" },
        { status: 400 }
      );
    }

    const paymentReference = `tool_${userId}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    const metadata = {
      purchase_type: "vendor_premium_tool",
      vendor_id: userId,
      tool_name: toolName,
      billing,
    };

    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin.from("payments").insert({
      user_id: userId,
      total_amount: amountKobo / 100,
      status: "pending",
      payment_reference: paymentReference,
    });

    if (error) {
      console.warn("vendor-tools/initialize: payments insert failed (non-blocking)", { message: error.message });
    }

    return NextResponse.json({
      success: true,
      data: {
        paymentReference,
        amountKobo,
        metadata,
      },
    });
  } catch (err) {
    console.error("vendor-tools/initialize error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
