import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { hasFeature, resolveFeatureNameFromTool } from "@/lib/vendor-feature-entitlements";
import { ensureAuthenticatedRequest } from "@/lib/api/ensureAuthenticatedRequest";

export async function POST(req: Request) {
  try {
    const authCheck = await ensureAuthenticatedRequest(req);
    if (!authCheck.ok) return authCheck.response;

    const body = (await req.json()) as {
      userId?: string;
      paymentReference?: string;
      toolName?: string;
    };
    const userId =
      authCheck.context.isAdmin && body.userId ? body.userId : authCheck.context.userId;
    const { paymentReference, toolName } = body;
    if (!userId || !paymentReference) {
      return NextResponse.json(
        { success: false, error: "userId and paymentReference are required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdminClient();

    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("id, status, processed_at")
      .eq("payment_reference", paymentReference)
      .maybeSingle();

    const { data: toolRow } = await supabaseAdmin
      .from("vendor_purchased_tools")
      .select("id, status, expiry_date")
      .eq("payment_reference", paymentReference)
      .eq("vendor_id", userId)
      .maybeSingle();

    const toolActive =
      !!toolRow &&
      toolRow.status === "active" &&
      (!toolRow.expiry_date || new Date(toolRow.expiry_date).getTime() > Date.now());

    let featureActive = toolActive;
    if (!featureActive && toolName) {
      const featureName = resolveFeatureNameFromTool(toolName);
      if (featureName) featureActive = await hasFeature(userId, featureName);
    }

    return NextResponse.json({
      success: true,
      data: {
        paymentStatus: payment?.status ?? "pending",
        processedAt: payment?.processed_at ?? null,
        featureActive: featureActive || toolActive,
      },
    });
  } catch (err) {
    console.error("vendor-tools/status error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
