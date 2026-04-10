export const UPLOAD_IMAGE_PURPOSES = [
  "menu_item",
  "vendor_profile",
  "user_avatar",
  "sponsored_banner",
  "admin_featured",
] as const;

export type UploadImagePurpose = (typeof UPLOAD_IMAGE_PURPOSES)[number];
