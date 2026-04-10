import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { parseJsonBody } from "@/lib/validation/http";
import { subscriptionUpdateSchema } from "@/lib/validation/schemas";

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const parsed = await parseJsonBody(req, subscriptionUpdateSchema, "POST /api/subscription/update");
    if (!parsed.ok) return parsed.response;

    const { userId, subscriptionPlan, paymentReference } = parsed.data;

    console.log("🔄 Subscription update request:", { userId, subscriptionPlan, paymentReference });

    // Calculate is_premium based on plan
    const isPremium = subscriptionPlan === "professional";

    // Update profiles table (PRIMARY SOURCE)
    const { data: profileUpdate, error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        subscription_plan: subscriptionPlan,
        is_premium: isPremium,
      })
      .eq("id", userId)
      .select("id, subscription_plan, is_premium")
      .single();

    if (profileError) {
      console.error("❌ Error updating profiles table:", profileError);
      return NextResponse.json(
        { success: false, error: `Failed to update profile: ${profileError.message}` },
        { status: 500 }
      );
    }

    console.log("✅ Profile updated:", profileUpdate);

    // Also update vendors table for consistency
    const { error: vendorError } = await supabaseAdmin
      .from("vendors")
      .update({
        subscription_plan: subscriptionPlan,
        is_premium: isPremium,
      })
      .eq("profile_id", userId);

    if (vendorError) {
      console.warn("⚠️ Warning: Failed to update vendors table (non-critical):", vendorError);
      // Don't fail the whole operation - profiles table is primary source
    } else {
      console.log("✅ Vendors table updated");
    }

    // Optionally: Store payment reference in a subscription_payments table if it exists
    // This would track payment history

    console.log("✅ Subscription update successful:", {
      userId,
      subscriptionPlan,
      isPremium,
      paymentReference,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          subscription_plan: subscriptionPlan,
          is_premium: isPremium,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("🔥 Subscription update API error:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}





