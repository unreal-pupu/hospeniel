import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function POST(req: Request) {
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

