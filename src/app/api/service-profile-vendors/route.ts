import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { checkRateLimit, RateLimitConfigs } from "@/lib/rateLimiter";

function hasCompletedServiceProfile(profile: {
  image_url: string | null;
  specialties: string[] | null;
  base_price: number | null;
  pricing_model: string | null;
  bio: string | null;
  service_mode: string[] | null;
}) {
  const hasSpecialties = (profile.specialties || []).length > 0;
  const hasServiceMode = (profile.service_mode || []).length > 0;
  const hasImage = !!profile.image_url;
  const hasBio = !!profile.bio?.trim();
  const hasBasePrice = (profile.base_price || 0) > 0;
  const hasPricingModel = !!profile.pricing_model;

  return hasSpecialties || hasServiceMode || hasImage || hasBio || hasBasePrice || hasPricingModel;
}

function normalizeCategory(category: string | null | undefined) {
  if (!category) return null;
  const normalized = category.toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "chef") return "chef";
  if (normalized === "home_cook") return "home_cook";
  return null;
}

export async function GET(req: Request) {
  const supabase = getSupabaseAdminClient();
  // Rate limiting
  const rateLimitResult = checkRateLimit(
    "/api/service-profile-vendors",
    req,
    RateLimitConfigs.SEARCH
  );

  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        retryAfter: rateLimitResult.retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": rateLimitResult.retryAfter?.toString() || "60",
        },
      }
    );
  }

  try {
    console.log("🔍 API: Fetching service profile vendors (chefs/home cooks)...");

    // Step 1: Fetch chef/home cook profiles (profiles is source of truth)
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, name, category, location, role")
      .eq("role", "vendor")
      .in("category", ["chef", "home_cook"]);

    if (profilesError) {
      console.error("❌ API: Error fetching chef/home cook profiles:", profilesError);
      return NextResponse.json(
        { error: "Failed to fetch profiles", details: profilesError.message },
        { status: 500 }
      );
    }

    console.log("🔍 API: Raw profiles count:", profilesData?.length || 0);
    const profileIds = (profilesData || []).map((profile) => profile.id);
    if (profileIds.length === 0) {
      console.log("ℹ️ API: No chef/home cook profiles found");
      return NextResponse.json({ vendors: [] });
    }

    // Step 2: Fetch service profiles for these vendors
    const { data: serviceProfilesData, error: serviceProfilesError } = await supabase
      .from("vendor_service_profiles")
      .select("profile_id, image_url, specialties, base_price, pricing_model, bio, service_mode")
      .in("profile_id", profileIds);

    if (serviceProfilesError) {
      console.error("❌ API: Error fetching service profiles:", serviceProfilesError);
      return NextResponse.json(
        { error: "Failed to fetch service profiles", details: serviceProfilesError.message },
        { status: 500 }
      );
    }

    const serviceProfiles = serviceProfilesData || [];
    console.log("🔍 API: Raw service profiles count:", serviceProfiles.length);
    const serviceProfileMap = new Map(
      serviceProfiles.map((profile) => [profile.profile_id, profile])
    );
    const allowMissingServiceProfiles = serviceProfiles.length === 0;

    // Step 3: Combine data for chefs/home cooks with completed service profiles
    const vendors = (profilesData || [])
      .map((profile) => {
        const category = normalizeCategory(profile.category);
        if (category !== "chef" && category !== "home_cook") return null;

        const serviceProfile = serviceProfileMap.get(profile.id);
        if (!serviceProfile && !allowMissingServiceProfiles) return null;
        if (serviceProfile && !hasCompletedServiceProfile(serviceProfile)) return null;

        return {
          id: profile.id,
          profile_id: profile.id,
          name: profile.name || "Unknown",
          image_url: serviceProfile?.image_url || null,
          location: profile.location || null,
          category: category,
          specialties: serviceProfile?.specialties || [],
          pricing_model: serviceProfile?.pricing_model || "per_meal",
          base_price: serviceProfile?.base_price || 0,
          service_mode: serviceProfile?.service_mode || [],
          bio: serviceProfile?.bio || null,
        };
      })
      .filter((vendor): vendor is NonNullable<typeof vendor> => vendor !== null);

    console.log(`✅ API: Combined ${vendors.length} chef/home cook profiles`, {
      allowMissingServiceProfiles,
      rawServiceProfilesCount: serviceProfiles.length,
    });

    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1";

    return NextResponse.json({
      vendors,
      ...(debug && {
        debug: {
          rawProfilesCount: profilesData?.length || 0,
          rawServiceProfilesCount: serviceProfilesData?.length || 0,
          combinedCount: vendors.length,
        },
      }),
    });
  } catch (error) {
    console.error("❌ API: Error in service profile vendors:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: "Internal server error", details: errorMessage },
      { status: 500 }
    );
  }
}
