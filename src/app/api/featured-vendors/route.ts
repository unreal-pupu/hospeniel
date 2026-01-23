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
    interface ServiceProfileRow {
      profile_id: string;
      image_url: string | null;
      specialties: string[] | null;
      base_price: number | null;
      pricing_model: string | null;
      bio: string | null;
      service_mode: string[] | null;
    }

    interface ProfileRow {
      id: string;
      name: string | null;
      category: string | null;
      location: string | null;
      featured_image: string | null;
      featured_description: string | null;
      is_featured: boolean | null;
    }

    interface ServiceProfileEntry extends ServiceProfileRow {
      profile: ProfileRow;
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
    }

    // Fetch featured vendors from profiles table
    // Using service role key to bypass RLS for public access
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, name, featured_image, featured_description, is_featured, category, location")
      .eq("role", "vendor")
      .eq("is_featured", true)
      .order("created_at", { ascending: false })
      .limit(8);

    if (profilesError) {
      console.error("Error fetching featured vendors:", profilesError);
      return NextResponse.json(
        { error: "Failed to fetch featured vendors", details: profilesError.message },
        { status: 500 }
      );
    }

    // Also fetch chefs and home cooks with completed service profiles (even if not featured)
    // This ensures they appear on the homepage
    const { data: allServiceProfiles, error: serviceProfilesError } = await supabase
      .from("vendor_service_profiles")
      .select("profile_id, image_url, specialties, base_price, pricing_model, bio, service_mode");

    const serviceProfilesMap = new Map<string, ServiceProfileEntry>();
    
    if (!serviceProfilesError && allServiceProfiles) {
      const serviceProfiles = allServiceProfiles as ServiceProfileRow[];
      const allowMissingServiceProfiles = serviceProfiles.length === 0;

      // Get profile IDs with service profiles
      const serviceProfileIds = serviceProfiles
        .map(sp => sp.profile_id)
        .filter(Boolean);
      
      if (serviceProfileIds.length > 0 || allowMissingServiceProfiles) {
        // Fetch profiles for these service profiles (profiles is source of truth)
        const serviceProfileUsersQuery = supabase
          .from("profiles")
          .select("id, name, category, location, featured_image, featured_description, is_featured")
          .eq("role", "vendor")
          .in("category", ["chef", "home_cook"]);

        const { data: serviceProfileUsers, error: serviceProfileUsersError } = allowMissingServiceProfiles
          ? await serviceProfileUsersQuery
          : await serviceProfileUsersQuery.in("id", serviceProfileIds);

        if (!serviceProfileUsersError && serviceProfileUsers) {
          const serviceProfileMap = new Map(
            serviceProfiles.map(sp => [sp.profile_id, sp])
          );

          (serviceProfileUsers as ProfileRow[]).forEach(profile => {
            const serviceProfile = serviceProfileMap.get(profile.id);
            const category = normalizeCategory(profile.category);

            if (!category) {
              return;
            }

            if (category !== "chef" && category !== "home_cook") {
              return;
            }

            if (serviceProfile && !hasCompletedServiceProfile(serviceProfile)) {
              return;
            }

            serviceProfilesMap.set(profile.id, {
              ...(serviceProfile || {
                profile_id: profile.id,
                image_url: null,
                specialties: [],
                base_price: 0,
                pricing_model: null,
                bio: null,
                service_mode: [],
              }),
              specialties: serviceProfile?.specialties || [],
              profile: {
                ...profile,
                category,
              }
            });
          });
        }
      }
    }

    // Combine featured vendors with service profile vendors
    const featuredVendorIds = new Set((profilesData || []).map(p => p.id));
    const vendors: FeaturedVendorRow[] = [];
    
    // Add featured vendors
    (profilesData || []).forEach(profile => {
      const serviceProfile = serviceProfilesMap.get(profile.id);
      const category = normalizeCategory(profile.category);
      const specialties = serviceProfile?.specialties || [];
      const serviceDescription =
        serviceProfile?.bio || (specialties.length > 0
          ? `Specializing in ${specialties.slice(0, 2).join(', ')}`
          : "Specialized culinary services");
      const image = serviceProfile?.image_url || profile.featured_image;

      const isChefOrHomeCook = category === "chef" || category === "home_cook";
      
      vendors.push({
        ...profile,
        featured_image: image,
        featured_description: isChefOrHomeCook && serviceProfile
          ? serviceDescription
          : profile.featured_description,
        specialties,
        ...(serviceProfile && {
          base_price: serviceProfile.base_price ?? null,
          pricing_model: serviceProfile.pricing_model ?? null,
        })
      });
    });
    
    // Add service profile vendors that aren't already in featured list
    // Limit to 4 additional to keep total around 8
    const additionalServiceVendors = Array.from(serviceProfilesMap.values())
      .filter(sp => !featuredVendorIds.has(sp.profile_id))
      .slice(0, 4)
      .map(sp => {
        const specialties = sp.specialties || [];
        const description =
          sp.bio || (specialties.length > 0
            ? `Specializing in ${specialties.slice(0, 2).join(', ')}`
            : "Specialized culinary services");

        return {
          id: sp.profile_id,
          name: sp.profile.name,
          featured_image: sp.image_url,
          featured_description: description,
          is_featured: false, // Not explicitly featured, but included for visibility
          category: sp.profile.category,
          location: sp.profile.location,
          specialties,
          base_price: sp.base_price,
          pricing_model: sp.pricing_model,
        };
      });
    
    vendors.push(...additionalServiceVendors);

    return NextResponse.json({ vendors });
  } catch (error) {
    console.error("Error in featured vendors API:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: "Internal server error", details: errorMessage },
      { status: 500 }
    );
  }
}

