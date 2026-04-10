import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseJsonBody } from "@/lib/validation/http";
import { vendorRatingSubmitSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface VendorRatingRow {
  id: string;
  vendor_id: string | number;
  user_id: string;
  rating: number;
  review: string | null;
  created_at: string;
}

function buildSupabaseClient(token?: string | null) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase client configuration missing");
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}

export async function OPTIONS() {
  return NextResponse.json({ success: true }, { status: 200 });
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = buildSupabaseClient(token);
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const parsed = await parseJsonBody(req, vendorRatingSubmitSchema, "POST /api/vendor-ratings");
    if (!parsed.ok) return parsed.response;

    const { vendor_id: vendorId, rating, review } = parsed.data;

    const { error: upsertError, data: upsertData } = await supabase
      .from("vendor_ratings")
      .upsert(
        {
          vendor_id: vendorId,
          user_id: userData.user.id,
          rating,
          review,
        },
        { onConflict: "vendor_id,user_id" }
      )
      .select("id")
      .maybeSingle();

    if (upsertError) {
      console.error("Error saving vendor rating:", {
        message: upsertError.message,
        details: upsertError.details,
        hint: upsertError.hint,
        code: upsertError.code,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Failed to save rating",
          details: upsertError.message,
        },
        { status: 500 }
      );
    }

    const { data: ratingsData, error: ratingsError } = await supabase
      .from("vendor_ratings")
      .select("id, vendor_id, user_id, rating, review, created_at")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false });

    if (ratingsError) {
      console.error("Error fetching vendor ratings:", ratingsError);
      return NextResponse.json({ success: false, error: "Failed to load ratings" }, { status: 500 });
    }

    const ratingRows = (ratingsData || []) as VendorRatingRow[];
    const total = ratingRows.reduce((sum, row) => sum + (row.rating || 0), 0);
    const count = ratingRows.length;
    const average = count > 0 ? total / count : 0;

    return NextResponse.json(
      {
        success: true,
        average,
        count,
        ratings: ratingRows,
        current_rating_id: upsertData?.id || null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Vendor ratings API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
