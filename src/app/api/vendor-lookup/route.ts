import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logValidationFailure } from "@/lib/validation/http";
import { profileIdQuerySchema } from "@/lib/validation/schemas";
import { checkRateLimit, RateLimitConfigs } from "@/lib/rateLimiter";

export async function GET(req: Request) {
  const rateLimitResult = checkRateLimit(
    "/api/vendor-lookup",
    req,
    RateLimitConfigs.PUBLIC_LISTING
  );
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": rateLimitResult.retryAfter?.toString() || "60",
          "X-RateLimit-Limit": RateLimitConfigs.PUBLIC_LISTING.maxRequests.toString(),
          "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
          "X-RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString(),
        },
      }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const rawProfileId = searchParams.get("profile_id");
    const idParsed = profileIdQuerySchema.safeParse(rawProfileId ?? "");
    if (!idParsed.success) {
      logValidationFailure("GET /api/vendor-lookup", idParsed.error.flatten());
      return NextResponse.json(
        { success: false, error: "A valid profile is required." },
        { status: 400 }
      );
    }
    const profileId = idParsed.data;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { success: false, error: "Supabase client configuration missing" },
        { status: 500 }
      );
    }
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from("vendors")
      .select("id")
      .eq("profile_id", profileId);

    if (error) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch vendor record", details: error.message },
        { status: 500 }
      );
    }

    const rows = data || [];
    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Vendor record not found" },
        { status: 404 }
      );
    }

    if (rows.length > 1) {
      return NextResponse.json(
        {
          success: false,
          error: "Duplicate vendor records found",
          vendor_ids: rows.map((row) => row.id),
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, vendor_id: rows[0].id });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
