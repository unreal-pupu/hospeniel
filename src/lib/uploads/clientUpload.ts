"use client";

import type { UploadImagePurpose } from "./types";

export type { UploadImagePurpose } from "./types";
export { UPLOAD_IMAGE_PURPOSES } from "./types";

/**
 * Upload an image through the validated server route. Pass a valid Supabase access token.
 */
export async function uploadImageViaApi(options: {
  file: File;
  purpose: UploadImagePurpose;
  accessToken: string;
  vendorProfileId?: string;
}): Promise<{ publicUrl: string; path: string }> {
  const { file, purpose, accessToken, vendorProfileId } = options;

  const body = new FormData();
  body.append("file", file);
  body.append("purpose", purpose);
  if (purpose === "admin_featured" && vendorProfileId) {
    body.append("vendorProfileId", vendorProfileId);
  }

  const res = await fetch("/api/storage/upload-image", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body,
  });

  let data: { error?: string; publicUrl?: string; path?: string } = {};
  try {
    data = await res.json();
  } catch {
    throw new Error("Upload failed. Please try again.");
  }

  if (!res.ok || !data.publicUrl) {
    throw new Error(data.error || "Upload failed. Please check the file and try again.");
  }

  return { publicUrl: data.publicUrl, path: data.path || "" };
}

/** Accept attribute for file inputs (browser hint only). */
export const IMAGE_FILE_INPUT_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
