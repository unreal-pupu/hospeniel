import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { checkRateLimit, RateLimitConfigs } from "@/lib/rateLimiter";
import {
  HOMEPAGE_FEATURED_PLACEMENT_TOOL_NAME_VARIANTS,
  explainHomepageFeaturedQualification,
  isHomepageFeaturedPlacementToolName,
  isProfileAdminFeaturedStrict,
  isStrictlyActiveFeaturedPlacementPurchase,
  normalizeVendorUuid,
  qualifiesForHomepageFeaturedSection,
  type FeaturedPlacementToolRow,
} from "@/lib/homepage-featured-eligibility";

export const dynamic = "force-dynamic";

function noStoreJson(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}

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
  is_featured_by_admin: boolean;
  has_homepage_featured_placement: boolean;
  category: string | null;
  location: string | null;
  specialties: string[];
  base_price?: number | null;
  pricing_model?: string | null;
  verified?: boolean | null;
}

interface VendorEligibilityProof {
  vendor_id: string;
  name: string | null;
  profile_is_featured_raw: unknown;
  profile_is_featured_typeof: string;
  /** true only when raw value is JavaScript boolean true */
  is_featured_by_admin: boolean;
  has_homepage_featured_placement: boolean;
  paid_tool_used_for_qualification: {
    tool_name: string;
    status: string;
    expiry_date: string | null;
  } | null;
  /** Every Featured Placement–variant row loaded from DB for this vendor (before/after strict — see passes_strict). */
  feature_placement_tool_rows_from_db: Array<{
    tool_name: string;
    status: string;
    expiry_date: string | null;
    passes_strict_validation: boolean;
    strict_fail_reason?: string;
  }>;
  server_now_ms: number;
  server_now_iso: string;
  qualifies_for_homepage_featured_section: boolean;
  why_qualifies: string;
}

function strictFailReason(row: FeaturedPlacementToolRow, nowMs: number): string {
  const parts: string[] = [];
  if (!isHomepageFeaturedPlacementToolName(row.tool_name)) {
    parts.push(`tool_name ${JSON.stringify(row.tool_name)} is not a Featured Placement variant`);
  }
  if (row.status == null || String(row.status).trim().toLowerCase() !== "active") {
    parts.push(`status is not active (got ${JSON.stringify(row.status)})`);
  }
  if (row.expiry_date == null || String(row.expiry_date).trim() === "") {
    parts.push("expiry_date null or empty");
  } else {
    const exp = new Date(row.expiry_date).getTime();
    if (Number.isNaN(exp)) parts.push("expiry_date not parseable as Date");
    else if (exp <= nowMs) {
      parts.push(
        `expiry_date ${row.expiry_date} (${exp}) is not after server now ${new Date(nowMs).toISOString()} (${nowMs})`
      );
    }
  }
  return parts.join("; ") || "unknown";
}

export async function GET(req: Request) {
  const supabase = getSupabaseAdminClient();
  const debugFeatured = process.env.DEBUG_FEATURED_VENDORS === "1";
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

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
    const profileSelect =
      "id, name, category, location, featured_image, featured_description, is_featured, verified";

    const { data: rawToolRows, error: toolRowsError } = await supabase
      .from("vendor_purchased_tools")
      .select("vendor_id, tool_name, status, expiry_date")
      .in("tool_name", [...HOMEPAGE_FEATURED_PLACEMENT_TOOL_NAME_VARIANTS]);

    if (toolRowsError) {
      console.warn("[featured-vendors] purchased tools fetch failed:", toolRowsError);
    }

    const rawToolRowsByVendorNorm = new Map<string, FeaturedPlacementToolRow[]>();
    for (const row of rawToolRows || []) {
      const r = row as FeaturedPlacementToolRow & { vendor_id: string };
      const nid = normalizeVendorUuid(r.vendor_id);
      if (!nid) continue;
      const list = rawToolRowsByVendorNorm.get(nid) ?? [];
      list.push({
        tool_name: r.tool_name,
        status: r.status,
        expiry_date: r.expiry_date,
      });
      rawToolRowsByVendorNorm.set(nid, list);
    }

    const paidEvidenceByVendor = new Map<
      string,
      { tool_name: string; status: string; expiry_date: string | null; vendor_id_raw: string }
    >();

    for (const row of rawToolRows || []) {
      const r = row as FeaturedPlacementToolRow & { vendor_id: string };
      if (!isStrictlyActiveFeaturedPlacementPurchase(r, nowMs)) {
        if (debugFeatured) {
          console.log("[featured-vendors] rejected tool row (strict check failed)", {
            vendor_id: r.vendor_id,
            tool_name: r.tool_name,
            status: r.status,
            expiry_date: r.expiry_date,
          });
        }
        continue;
      }
      const nid = normalizeVendorUuid(r.vendor_id);
      if (!nid) continue;
      if (!paidEvidenceByVendor.has(nid)) {
        paidEvidenceByVendor.set(nid, {
          tool_name: r.tool_name,
          status: r.status,
          expiry_date: r.expiry_date,
          vendor_id_raw: String(r.vendor_id),
        });
      }
    }

    const paidIdsForQuery = [...new Set([...paidEvidenceByVendor.values()].map((v) => v.vendor_id_raw))];

    if (debugFeatured) {
      console.log("[featured-vendors] paidEvidenceByVendor (strict)", {
        count: paidEvidenceByVendor.size,
        keys: [...paidEvidenceByVendor.keys()],
      });
    }

    // Two explicit queries (no PostgREST `.or()`): eliminates filter-precedence ambiguity.
    const { data: adminProfileRows, error: adminErr } = await supabase
      .from("profiles")
      .select(profileSelect)
      .eq("role", "vendor")
      .eq("is_featured", true)
      .limit(50);

    if (adminErr) {
      console.error("[featured-vendors] admin profiles fetch error:", adminErr);
    }

    let paidProfileRows: ProfileRow[] = [];
    if (paidIdsForQuery.length > 0) {
      const { data: paidData, error: paidErr } = await supabase
        .from("profiles")
        .select(profileSelect)
        .eq("role", "vendor")
        .in("id", paidIdsForQuery);

      if (paidErr) {
        console.error("[featured-vendors] paid-id profiles fetch error:", paidErr);
      } else {
        paidProfileRows = (paidData || []) as ProfileRow[];
      }
    }

    const mergedById = new Map<string, ProfileRow>();
    for (const p of (adminProfileRows || []) as ProfileRow[]) mergedById.set(p.id, p);
    for (const p of paidProfileRows) {
      if (!mergedById.has(p.id)) mergedById.set(p.id, p);
    }

    const profilesRaw = [...mergedById.values()];

    const profilesStrict: ProfileRow[] = profilesRaw.filter((p: ProfileRow) => {
      const nid = normalizeVendorUuid(p.id);
      const admin = isProfileAdminFeaturedStrict(p.is_featured);
      const paid = paidEvidenceByVendor.has(nid);
      const keep = admin || paid;
      if (debugFeatured && !keep) {
        console.log("[featured-vendors] dropped profile (fails admin|paid proof)", {
          id: p.id,
          name: p.name,
          is_featured: p.is_featured,
          typeof_is_featured: typeof p.is_featured,
          inPaidSet: paid,
        });
      }
      return keep;
    });

    if (profilesStrict.length === 0) {
      const emptyPayload: {
        vendors: FeaturedVendorRow[];
        eligibility_debug?: {
          server_now_ms: number;
          server_now_iso: string;
          vendors_returned_in_json: VendorEligibilityProof[];
          all_candidates_evaluated: VendorEligibilityProof[];
        };
      } = { vendors: [] };
      if (debugFeatured) {
        emptyPayload.eligibility_debug = {
          server_now_ms: nowMs,
          server_now_iso: nowIso,
          vendors_returned_in_json: [],
          all_candidates_evaluated: [],
        };
      }
      return noStoreJson(emptyPayload);
    }

    const chefHomeIds = profilesStrict
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
    const eligibilityProofs: VendorEligibilityProof[] = [];

    for (const profile of profilesStrict) {
      const serviceProfile = serviceProfileMap.get(profile.id);
      const category = normalizeCategory(profile.category);
      const specialties = serviceProfile?.specialties || [];
      const image = serviceProfile?.image_url || profile.featured_image;
      const isChefOrHomeCook = category === "chef" || category === "home_cook";

      const nid = normalizeVendorUuid(profile.id);
      const paidProof = paidEvidenceByVendor.get(nid) ?? null;
      const isFeaturedByAdmin = isProfileAdminFeaturedStrict(profile.is_featured);
      const hasHomepageFeaturedPlacement = paidProof != null;

      const dbToolRows = rawToolRowsByVendorNorm.get(nid) ?? [];
      const featurePlacementToolRowsFromDb = dbToolRows.map((tr) => {
        const passes = isStrictlyActiveFeaturedPlacementPurchase(tr, nowMs);
        return {
          tool_name: tr.tool_name,
          status: tr.status,
          expiry_date: tr.expiry_date,
          passes_strict_validation: passes,
          strict_fail_reason: passes ? undefined : strictFailReason(tr, nowMs),
        };
      });

      const qualifies = qualifiesForHomepageFeaturedSection(
        isFeaturedByAdmin,
        hasHomepageFeaturedPlacement,
        debugFeatured
          ? {
              vendorId: profile.id,
              profileIsFeaturedRaw: profile.is_featured as boolean | null,
              paidTool: paidProof
                ? {
                    tool_name: paidProof.tool_name,
                    status: paidProof.status,
                    expiry_date: paidProof.expiry_date,
                  }
                : null,
            }
          : undefined
      );

      if (debugFeatured) {
        eligibilityProofs.push({
          vendor_id: profile.id,
          name: profile.name,
          profile_is_featured_raw: profile.is_featured,
          profile_is_featured_typeof: typeof profile.is_featured,
          is_featured_by_admin: isFeaturedByAdmin,
          has_homepage_featured_placement: hasHomepageFeaturedPlacement,
          paid_tool_used_for_qualification: paidProof
            ? {
                tool_name: paidProof.tool_name,
                status: paidProof.status,
                expiry_date: paidProof.expiry_date,
              }
            : null,
          feature_placement_tool_rows_from_db: featurePlacementToolRowsFromDb,
          server_now_ms: nowMs,
          server_now_iso: nowIso,
          qualifies_for_homepage_featured_section: qualifies,
          why_qualifies: explainHomepageFeaturedQualification(
            isFeaturedByAdmin,
            hasHomepageFeaturedPlacement
          ),
        });
      }

      if (!qualifies) {
        if (debugFeatured) {
          console.warn("[featured-vendors] row failed qualifies (should not happen)", {
            id: profile.id,
            isFeaturedByAdmin,
            hasHomepageFeaturedPlacement,
          });
        }
        continue;
      }

      vendors.push({
        id: profile.id,
        name: profile.name,
        featured_image: image,
        featured_description:
          (isChefOrHomeCook && serviceProfile?.bio) || profile.featured_description,
        is_featured: profile.is_featured,
        is_featured_by_admin: isFeaturedByAdmin,
        has_homepage_featured_placement: hasHomepageFeaturedPlacement,
        category: profile.category,
        location: profile.location,
        verified: profile.verified,
        specialties,
        base_price: serviceProfile?.base_price ?? null,
        pricing_model: serviceProfile?.pricing_model ?? null,
      });
    }

    const sortedVendors = vendors
      .sort(
        (a, b) =>
          Number(Boolean(b.is_featured_by_admin)) - Number(Boolean(a.is_featured_by_admin))
      )
      .slice(0, 8);

    if (debugFeatured) {
      const proofById = new Map(eligibilityProofs.map((p) => [p.vendor_id, p]));
      for (const v of sortedVendors) {
        const proof = proofById.get(v.id);
        console.log("[featured-vendors] response row (proof)", {
          id: v.id,
          name: v.name,
          ...proof,
        });
      }
    }

    const payload: {
      vendors: FeaturedVendorRow[];
      eligibility_debug?: {
        server_now_ms: number;
        server_now_iso: string;
        vendors_returned_in_json: VendorEligibilityProof[];
        all_candidates_evaluated: VendorEligibilityProof[];
      };
    } = { vendors: sortedVendors };

    if (debugFeatured) {
      payload.eligibility_debug = {
        server_now_ms: nowMs,
        server_now_iso: nowIso,
        vendors_returned_in_json: eligibilityProofs.filter((p) =>
          sortedVendors.some((v) => v.id === p.vendor_id)
        ),
        all_candidates_evaluated: eligibilityProofs,
      };
    }

    return noStoreJson(payload);
  } catch (error) {
    console.error("Error in featured vendors API:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return noStoreJson(
      { error: "Internal server error", details: errorMessage },
      { status: 500 }
    );
  }
}
