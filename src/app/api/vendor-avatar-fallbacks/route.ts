import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, RateLimitConfigs } from "@/lib/rateLimiter";

interface AvatarRow {
  user_id: string;
  avatar_url: string | null;
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(req: Request) {
  const rateLimitResult = checkRateLimit(
    "/api/vendor-avatar-fallbacks",
    req,
    RateLimitConfigs.SEARCH
  );
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": rateLimitResult.retryAfter?.toString() || "60",
        },
      }
    );
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("vendor-avatar-fallbacks: missing server env vars", {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
      });
      return NextResponse.json(
        { error: "Server is missing Supabase admin configuration." },
        { status: 500 }
      );
    }

    // Guardrail: service-role key must not be the same as anon key.
    if (anonKey && serviceRoleKey === anonKey) {
      console.error("vendor-avatar-fallbacks: service role key is identical to anon key");
      return NextResponse.json(
        { error: "Server Supabase admin key is misconfigured." },
        { status: 500 }
      );
    }

    console.log("vendor-avatar-fallbacks: runtime supabase key diagnostics", {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
      serviceRoleKeyFormat: serviceRoleKey.startsWith("sb_secret_")
        ? "sb_secret"
        : serviceRoleKey.startsWith("eyJ")
        ? "jwt"
        : "unknown",
      sameAsAnonKey: Boolean(anonKey && serviceRoleKey === anonKey),
    });

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: "public" },
    });
    const clientLabel = "service-role-inline-client";

    const body = (await req.json().catch(() => ({}))) as { vendorIds?: string[] };
    const vendorIds = Array.isArray(body.vendorIds)
      ? Array.from(
          new Set(
            body.vendorIds
              .filter((id): id is string => typeof id === "string")
              .map((id) => id.trim())
              .filter((id) => id.length > 0 && isUuidLike(id))
          )
        ).slice(0, 200)
      : [];

    if (vendorIds.length === 0) {
      return NextResponse.json(
        { avatars: [] },
        { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
      );
    }

    // Safety gate: only return rows for IDs that belong to real vendor records.
    const { data: vendorRows, error: vendorRowsError } = await supabase
      .from("vendors")
      .select("profile_id")
      .in("profile_id", vendorIds);

    if (vendorRowsError) {
      console.error("vendor-avatar-fallbacks: failed to verify vendor IDs", {
        code: vendorRowsError.code,
        message: vendorRowsError.message,
        details: vendorRowsError.details,
      });
      return NextResponse.json(
        { error: "Unable to verify vendors." },
        { status: 500, headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
      );
    }

    const allowedVendorIds = Array.from(
      new Set((vendorRows || []).map((row: { profile_id: string | null }) => row.profile_id).filter(Boolean))
    ) as string[];

    if (allowedVendorIds.length === 0) {
      return NextResponse.json(
        { avatars: [] },
        { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
      );
    }

    const { data: avatarRows, error: avatarError } = await supabase
      .from("user_settings")
      .select("user_id, avatar_url")
      .in("user_id", allowedVendorIds);

    if (avatarError) {
      if (avatarError.code === "42501") {
        console.error("vendor-avatar-fallbacks: permission denied reading user_settings; returning empty fallback set", {
          clientLabel,
          code: avatarError.code,
          message: avatarError.message,
          details: avatarError.details,
          hint: avatarError.hint,
        });
        return NextResponse.json(
          { avatars: [], warning: "user_settings_read_denied" },
          { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
        );
      }

      console.error("vendor-avatar-fallbacks: failed to fetch avatar fallbacks", {
        clientLabel,
        code: avatarError.code,
        message: avatarError.message,
        details: avatarError.details,
        hint: avatarError.hint,
      });
      return NextResponse.json(
        { error: "Unable to fetch avatar fallbacks." },
        { status: 500, headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
      );
    }

    const avatars = (avatarRows || []).map((row: AvatarRow) => ({
      user_id: row.user_id,
      avatar_url: row.avatar_url,
    }));

    return NextResponse.json(
      { avatars },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
    );
  } catch (error) {
    console.error("vendor-avatar-fallbacks: unexpected error", error);
    return NextResponse.json(
      { error: "Unexpected error while fetching avatar fallbacks." },
      { status: 500, headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
    );
  }
}
