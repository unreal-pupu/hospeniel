import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create admin client (service key = full DB access, bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, subscriptionPlan, paymentReference } = body;

    console.log("🔄 Subscription update request:", { userId, subscriptionPlan, paymentReference });

    // Validate input
    if (!userId || !subscriptionPlan) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: userId and subscriptionPlan" },
        { status: 400 }
      );
    }

    // Validate subscription plan value
    const validPlans = ["free_trial", "starter", "professional"];
    if (!validPlans.includes(subscriptionPlan)) {
      return NextResponse.json(
        { success: false, error: `Invalid subscription plan. Must be one of: ${validPlans.join(", ")}` },
        { status: 400 }
      );
    }

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
  } catch (err: any) {
    console.error("🔥 Subscription update API error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}





