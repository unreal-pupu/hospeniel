import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { processPremiumToolPayment, syncVendorEntitlementsFromPurchasedTools } from "@/lib/vendor-feature-entitlements";
import { ensureAuthenticatedRequest } from "@/lib/api/ensureAuthenticatedRequest";

const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;

export async function POST(req: Request) {
  try {
    const authCheck = await ensureAuthenticatedRequest(req);
    if (!authCheck.ok) return authCheck.response;

    if (!paystackSecretKey?.trim()) {
      return NextResponse.json(
        { success: false, error: "PAYSTACK_SECRET_KEY not configured" },
        { status: 500 }
      );
    }
    const body = (await req.json()) as { userId?: string };
    const userId =
      authCheck.context.isAdmin && body.userId ? body.userId : authCheck.context.userId;
    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { data: pendingRows, error } = await supabaseAdmin
      .from("payments")
      .select("payment_reference")
      .eq("vendor_id", userId)
      .eq("payment_type", "vendor_premium_tool")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    let processed = 0;
    for (const row of pendingRows || []) {
      const reference = row.payment_reference as string;
      if (!reference) continue;
      const verifyRes = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${paystackSecretKey.trim()}`,
            "Content-Type": "application/json",
          },
        }
      );
      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok || !verifyJson?.status || verifyJson?.data?.status !== "success") continue;
      const result = await processPremiumToolPayment({
        reference,
        transactionData: verifyJson.data,
      });
      if (result.ok) processed += 1;
    }

    // Ensure entitlements exist even if webhook/payment initialization happened before
    // the permissions/migrations were fully applied.
    try {
      await syncVendorEntitlementsFromPurchasedTools(userId);
    } catch (syncErr) {
      console.warn("[vendor-tools/reconcile] sync from purchased tools failed:", syncErr);
    }

    return NextResponse.json({
      success: true,
      scanned: pendingRows?.length || 0,
      processed,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
