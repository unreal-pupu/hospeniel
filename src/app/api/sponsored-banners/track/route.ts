import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { checkRateLimit, RateLimitConfigs } from "@/lib/rateLimiter";

export async function POST(req: Request) {
  const rateLimitResult = checkRateLimit(
    "/api/sponsored-banners/track",
    req,
    RateLimitConfigs.PUBLIC_LISTING
  );
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again later." },
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
    const body = (await req.json()) as {
      bannerId?: string;
      vendorId?: string;
      eventType?: "view" | "click" | "conversion";
    };

    const bannerId = body.bannerId;
    const vendorId = body.vendorId;
    const eventType = body.eventType;

    if (!bannerId || !vendorId || !eventType) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    if (!["view", "click", "conversion"].includes(eventType)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    await supabase.from("sponsored_banner_events").insert({
      banner_id: bannerId,
      vendor_id: vendorId,
      event_type: eventType,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/sponsored-banners/track error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

