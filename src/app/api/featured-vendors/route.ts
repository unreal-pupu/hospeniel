import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { checkRateLimit, RateLimitConfigs } from "@/lib/rateLimiter";

function normalizeCategory(category: string | null | undefined) {
  if (!category) return null;
  const normalized = category.toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "chef") return "chef";
  if (normalized === "home_cook") return "home_cook";
  return null;
}

interface ProfileRow {
  id: string;
  name: string | null;
  category: string | null;
  location: string | null;
  featured_image: string | null;
  featured_description: string | null;
  is_featured: boolean | null;
  verified?: boolean | null;
}

interface ServiceProfileRow {
  profile_id: string;
  image_url: string | null;
  specialties: string[] | null;
  bio: string | null;
  base_price: number | null;
  pricing_model: string | null;
}

interface FeaturedVendorRow {
  id: string;
  name: string | null;
  featured_image: string | null;
  featured_description: string | null;
  is_featured: boolean | null;
  category: string | null;
  location: string | null;
  specialties: string[];
  base_price?: number | null;
  pricing_model?: string | null;
  verified?: boolean | null;
}

export async function GET(req: Request) {
  const supabase = getSupabaseAdminClient();
  // Rate limiting: 50 requests per minute per IP (search/explore limit)
  const rateLimitResult = checkRateLimit(
    "/api/featured-vendors",
    req,
    RateLimitConfigs.SEARCH
  );

  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        retryAfter: rateLimitResult.retryAfter,
        message: `Rate limit exceeded. Please wait ${rateLimitResult.retryAfter} seconds before trying again.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": rateLimitResult.retryAfter?.toString() || "60",
          "X-RateLimit-Limit": RateLimitConfigs.SEARCH.maxRequests.toString(),
          "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
          "X-RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString(),
        },
      }
    );
  }
  try {
    // Strict eligibility: only admin-featured OR paid featured placement.
    // No fallback that includes non-featured vendors.
    const nowIso = new Date().toISOString();
    const eligibleVendorIds = new Set<string>();

    // 1) Admin-featured vendors
    const { data: adminFeaturedRows, error: adminFeaturedError } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "vendor")
      .eq("is_featured", true)
      .limit(50);

    if (adminFeaturedError) {
      console.error("[featured-vendors] admin featured fetch error:", adminFeaturedError);
    } else {
      for (const row of adminFeaturedRows || []) eligibleVendorIds.add(row.id);
    }

    // 2) Paid featured placement via entitlements
    try {
      const featureName = "featured_placement";
      const { data: featureRow } = await supabase
        .from("features")
        .select("id")
        .eq("name", featureName)
        .maybeSingle();

      if (featureRow?.id) {
        const { data: entRows, error: entRowsError } = await supabase
          .from("vendor_entitlements")
          .select("vendor_id")
          .eq("feature_id", featureRow.id)
          .eq("status", "active")
          .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

        if (entRowsError) {
          console.warn("[featured-vendors] entitlement rows fetch failed:", entRowsError);
        } else {
          for (const row of entRows || []) eligibleVendorIds.add(row.vendor_id);
        }
      }
    } catch (entitlementErr) {
      console.warn("[featured-vendors] entitlement lookup failed:", entitlementErr);
    }

    // 3) Paid featured placement via purchased tools (reliability fallback)
    try {
      const { data: toolRows, error: toolRowsError } = await supabase
        .from("vendor_purchased_tools")
        .select("vendor_id")
        .eq("tool_name", "Featured Placement")
        .eq("status", "active")
        .gt("expiry_date", nowIso);

      if (toolRowsError) {
        console.warn("[featured-vendors] purchased tools lookup failed:", toolRowsError);
      } else {
        for (const row of toolRows || []) eligibleVendorIds.add(row.vendor_id);
      }
    } catch (toolErr) {
      console.warn("[featured-vendors] purchased tools lookup error:", toolErr);
    }

    const vendorIds = Array.from(eligibleVendorIds);
    if (vendorIds.length === 0) return NextResponse.json({ vendors: [] });

    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, name, category, location, featured_image, featured_description, is_featured, verified")
      .eq("role", "vendor")
      .in("id", vendorIds);

    if (profilesError) {
      console.error("[featured-vendors] profile fetch error:", profilesError);
      return NextResponse.json(
        { error: "Failed to fetch featured vendors", details: profilesError.message },
        { status: 500 }
      );
    }

    const chefHomeIds = (profilesData || [])
      .filter((p: ProfileRow) => {
        const category = normalizeCategory(p.category);
        return category === "chef" || category === "home_cook";
      })
      .map((p: ProfileRow) => p.id);

    const { data: serviceProfilesData } = chefHomeIds.length
      ? await supabase
          .from("vendor_service_profiles")
          .select("profile_id, image_url, specialties, bio, base_price, pricing_model")
          .in("profile_id", chefHomeIds)
      : { data: [] as ServiceProfileRow[] };

    const serviceProfileMap = new Map<string, ServiceProfileRow>(
      (serviceProfilesData || []).map((sp: ServiceProfileRow) => [sp.profile_id, sp])
    );

    const vendors: FeaturedVendorRow[] = [];

    (profilesData || []).forEach((profile: ProfileRow) => {
      const serviceProfile = serviceProfileMap.get(profile.id);
      const category = normalizeCategory(profile.category);
      const specialties = serviceProfile?.specialties || [];
      const image = serviceProfile?.image_url || profile.featured_image;
      const isChefOrHomeCook = category === "chef" || category === "home_cook";

      vendors.push({
        id: profile.id,
        name: profile.name,
        featured_image: image,
        featured_description:
          (isChefOrHomeCook && serviceProfile?.bio) || profile.featured_description,
        is_featured: profile.is_featured,
        category: profile.category,
        location: profile.location,
        verified: profile.verified,
        specialties,
        base_price: serviceProfile?.base_price ?? null,
        pricing_model: serviceProfile?.pricing_model ?? null,
      });
    });

    // Prioritize admin-featured first, then paid-featured.
    const sortedVendors = vendors
      .sort((a, b) => Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured)))
      .slice(0, 8);

    return NextResponse.json({ vendors: sortedVendors });
  } catch (error) {
    console.error("Error in featured vendors API:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: "Internal server error", details: errorMessage },
      { status: 500 }
    );
  }
}

