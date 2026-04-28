import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { processPremiumToolPayment } from "@/lib/vendor-feature-entitlements";
import { logPaystackAuthorizationDebug } from "@/lib/server/paystackRequestDebug";

const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const trimmedPaystackKey = logPaystackAuthorizationDebug(
      "cron/reconcile-vendor-tool-payments:verify-request",
      paystackSecretKey
    );
    if (!trimmedPaystackKey) {
      return NextResponse.json(
        { success: false, error: "PAYSTACK_SECRET_KEY not configured" },
        { status: 500 }
      );
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { data: pendingRows, error } = await supabaseAdmin
      .from("payments")
      .select("payment_reference")
      .eq("payment_type", "vendor_premium_tool")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(100);

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
            Authorization: `Bearer ${trimmedPaystackKey}`,
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

    return NextResponse.json({ success: true, processed, scanned: pendingRows?.length || 0 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
