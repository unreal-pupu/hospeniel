import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { validateImageUpload } from "@/lib/uploads/validateImageUpload";
import type { UploadImagePurpose } from "@/lib/uploads/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PURPOSES: UploadImagePurpose[] = [
  "menu_item",
  "vendor_profile",
  "user_avatar",
  "sponsored_banner",
  "admin_featured",
];

function isPurpose(value: string): value is UploadImagePurpose {
  return (PURPOSES as string[]).includes(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Please sign in to upload files." },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7).trim();
    const supabaseAdmin = getSupabaseAdminClient();
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user?.id) {
      console.warn("[upload-image] Invalid or expired session");
      return NextResponse.json({ error: "Your session expired. Please sign in again." }, { status: 401 });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
    }

    const fileEntry = formData.get("file");
    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
    }

    const purposeRaw = String(formData.get("purpose") || "");
    if (!isPurpose(purposeRaw)) {
      return NextResponse.json({ error: "Invalid upload type." }, { status: 400 });
    }
    const purpose = purposeRaw;

    const buffer = new Uint8Array(await fileEntry.arrayBuffer());

    const validated = validateImageUpload({
      buffer,
      originalName: fileEntry.name || "upload",
      declaredMime: fileEntry.type,
    });

    if (!validated.ok) {
      console.warn("[upload-image] validation failed:", validated.message, {
        purpose,
        userId: user.id,
        name: fileEntry.name,
        declaredType: fileEntry.type,
      });
      return NextResponse.json({ error: validated.message }, { status: 400 });
    }

    const ext = validated.fileExtension;
    const idSegment = randomUUID();
    let bucket: string;
    let objectPath: string;
    let upsert = false;

    switch (purpose) {
      case "menu_item":
        bucket = "menu-images";
        objectPath = `${user.id}/${idSegment}.${ext}`;
        break;
      case "vendor_profile":
        bucket = "vendor-images";
        objectPath = `${user.id}/${idSegment}.${ext}`;
        break;
      case "user_avatar":
        bucket = "avatars";
        objectPath = `${user.id}/${idSegment}.${ext}`;
        upsert = false;
        break;
      case "sponsored_banner":
        bucket = "menu-images";
        objectPath = `${user.id}/sponsored-banners/${idSegment}.${ext}`;
        break;
      case "admin_featured": {
        const vendorProfileId = String(formData.get("vendorProfileId") || "").trim();
        if (!isUuid(vendorProfileId)) {
          return NextResponse.json({ error: "Invalid vendor selected." }, { status: 400 });
        }

        const { data: actorProfile, error: actorErr } = await supabaseAdmin
          .from("profiles")
          .select("role, is_admin")
          .eq("id", user.id)
          .maybeSingle();

        if (actorErr) {
          console.error("[upload-image] admin check:", actorErr);
          return NextResponse.json({ error: "Unable to verify permissions." }, { status: 500 });
        }

        const isAdmin = Boolean(actorProfile?.is_admin) || actorProfile?.role === "admin";
        if (!isAdmin) {
          return NextResponse.json({ error: "You do not have permission to upload here." }, { status: 403 });
        }

        bucket = "menu-images";
        objectPath = `featured-vendors/${vendorProfileId}/${idSegment}.${ext}`;
        break;
      }
      default:
        return NextResponse.json({ error: "Unsupported upload." }, { status: 400 });
    }

    const { error: uploadError } = await supabaseAdmin.storage.from(bucket).upload(objectPath, buffer, {
      contentType: validated.contentType,
      cacheControl: "3600",
      upsert,
    });

    if (uploadError) {
      console.error("[upload-image] storage error:", uploadError.message, { bucket, objectPath });
      return NextResponse.json(
        { error: "Could not store the file. Please try again or contact support." },
        { status: 500 }
      );
    }

    const { data: publicData } = supabaseAdmin.storage.from(bucket).getPublicUrl(objectPath);
    const publicUrl = publicData?.publicUrl;
    if (!publicUrl) {
      return NextResponse.json({ error: "Upload succeeded but public URL could not be resolved." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      publicUrl,
      path: objectPath,
      bucket,
    });
  } catch (e) {
    console.error("[upload-image] unexpected:", e);
    return NextResponse.json({ error: "Something went wrong with the upload." }, { status: 500 });
  }
}
