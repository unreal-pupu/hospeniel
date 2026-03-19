import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    const nowIso = new Date().toISOString();
    const debug = false;

    // Reliability: derive eligibility from the known-working legacy source `vendor_purchased_tools`,
    // not from `vendor_entitlements` (which may not be present / updated in all environments yet).
    const eligibleToolName = "Sponsored Banners";
    const { data: toolRows, error: toolRowsError } = await supabase
      .from("vendor_purchased_tools")
      .select("vendor_id")
      .eq("tool_name", eligibleToolName)
      .eq("status", "active")
      .gt("expiry_date", nowIso)
      .limit(50);

    if (toolRowsError) {
      console.error("GET /api/sponsored-banners eligible tool query failed:", toolRowsError);
    }

    const vendorIds = Array.from(
      new Set((toolRows || []).map((r: { vendor_id: string }) => r.vendor_id))
    );
    console.log("[sponsored-banners] eligible vendors:", {
      toolName: eligibleToolName,
      eligibleVendorCount: vendorIds.length,
    });
    if (vendorIds.length === 0) {
      return NextResponse.json({ banners: [] });
    }

    const { data: banners, error } = await supabase
      .from("sponsored_banners")
      .select("id, vendor_id, title, image_url, link_url, created_at")
      .eq("status", "active")
      .in("vendor_id", vendorIds)
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) {
      console.error("GET /api/sponsored-banners error:", error);
      return NextResponse.json({ banners: [] });
    }

    const bannerVendorIds = Array.from(new Set((banners || []).map((b: any) => b.vendor_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, featured_image")
      .in("id", bannerVendorIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    const result = (banners || []).map((b: any) => {
      const profile = profileMap.get(b.vendor_id);
      return {
        id: b.id,
        vendor_id: b.vendor_id,
        vendor_name: profile?.name ?? "Vendor",
        vendor_image: profile?.featured_image ?? null,
        title: b.title ?? null,
        image_url: b.image_url,
        link_url: b.link_url ?? `/vendors/profile/${b.vendor_id}`,
        created_at: b.created_at,
      };
    });

    console.log("[sponsored-banners] banners returned:", { count: result.length });
    return NextResponse.json({ banners: result });
  } catch (err) {
    console.error("GET /api/sponsored-banners fatal:", err);
    return NextResponse.json({ banners: [] });
  }
}

