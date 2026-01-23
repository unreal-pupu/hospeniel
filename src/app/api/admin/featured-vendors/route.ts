import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface FeaturedVendorPayload {
  id: string;
  is_featured?: boolean;
  featured_description?: string | null;
  featured_image?: string | null;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_admin, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const isAdmin = profile.is_admin === true || profile.role?.toLowerCase().trim() === "admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const payload = (await req.json()) as FeaturedVendorPayload;
    if (!payload?.id) {
      return NextResponse.json({ error: "Vendor id is required" }, { status: 400 });
    }

    const updateData: FeaturedVendorPayload = {
      id: payload.id,
    };

    if (payload.is_featured !== undefined) {
      updateData.is_featured = payload.is_featured;
    }
    if (payload.featured_description !== undefined) {
      updateData.featured_description = payload.featured_description;
    }
    if (payload.featured_image !== undefined) {
      updateData.featured_image = payload.featured_image;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        is_featured: updateData.is_featured,
        featured_description: updateData.featured_description ?? null,
        featured_image: updateData.featured_image ?? null,
      })
      .eq("id", updateData.id)
      .select("id, is_featured, featured_description, featured_image")
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update featured vendor", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ vendor: updated });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: "Internal server error", details: errorMessage },
      { status: 500 }
    );
  }
}
