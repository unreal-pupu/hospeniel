import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      vendorIds?: string[];
      featureName?: string;
    };

    const vendorIds = body.vendorIds || [];
    const featureName = body.featureName;

    if (!featureName) {
      return NextResponse.json({ success: false, error: "featureName is required" }, { status: 400 });
    }
    if (vendorIds.length === 0) {
      return NextResponse.json({ success: true, activeVendorIds: [] });
    }

    const supabase = getSupabaseAdminClient();
    const nowIso = new Date().toISOString();

    // Reliability: derive active feature vendors from the known-working `vendor_purchased_tools`.
    // This avoids cases where `vendor_entitlements` isn't updated (yet) even though the tool is active.
    const featureToToolName: Record<string, string> = {
      featured_placement: "Featured Placement",
      priority_location_boost: "Priority Location Boost",
      sponsored_banners: "Sponsored Banners",
      brand_promotion: "Brand Promotion",
      marketing_tools: "Marketing Tools",
      analytical_marketing: "Analytical Marketing",
    };

    const toolName = featureToToolName[featureName];
    if (toolName) {
      const { data: toolRows, error } = await supabase
        .from("vendor_purchased_tools")
        .select("vendor_id")
        .eq("tool_name", toolName)
        .eq("status", "active")
        .gt("expiry_date", nowIso)
        .in("vendor_id", vendorIds);

      if (error) {
        console.error("vendor-entitlements/active-feature toolRows error:", { featureName, toolName, error });
        return NextResponse.json({ success: true, activeVendorIds: [] });
      }

      const activeVendorIds = Array.from(
        new Set((toolRows || []).map((r: any) => r.vendor_id))
      );
      return NextResponse.json({ success: true, activeVendorIds });
    }

    // Fallback to entitlements table if featureName isn't mapped.
    const { data: featureRow } = await supabase
      .from("features")
      .select("id")
      .eq("name", featureName)
      .maybeSingle();

    if (!featureRow?.id) {
      return NextResponse.json({ success: true, activeVendorIds: [] });
    }

    const { data: entRows, error } = await supabase
      .from("vendor_entitlements")
      .select("vendor_id")
      .eq("feature_id", featureRow.id)
      .eq("status", "active")
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .in("vendor_id", vendorIds);

    if (error) {
      console.error("vendor-entitlements/active-feature error:", error);
      return NextResponse.json({ success: true, activeVendorIds: [] });
    }

    const activeVendorIds = Array.from(
      new Set((entRows || []).map((r: any) => r.vendor_id))
    );
    return NextResponse.json({ success: true, activeVendorIds });
  } catch (err) {
    console.error("vendor-entitlements/active-feature fatal:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

