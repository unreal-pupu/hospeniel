"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Megaphone, ShieldCheck, Trash2, Upload, RefreshCw } from "lucide-react";
import { uploadImageViaApi, IMAGE_FILE_INPUT_ACCEPT } from "@/lib/uploads/clientUpload";

type VendorToolRow = {
  tool_name: string;
  status: string;
  expiry_date: string;
};

type SponsoredBanner = {
  id: string;
  vendor_id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
  status: string;
  created_at: string;
};

function isToolActive(row: VendorToolRow): boolean {
  // Prefer expiry_date; status can be legacy snapshot
  const expires = row.expiry_date ? new Date(row.expiry_date).getTime() : 0;
  return expires > Date.now() || row.status === "active";
}

export default function VendorBannersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tools, setTools] = useState<VendorToolRow[]>([]);
  const [banners, setBanners] = useState<SponsoredBanner[]>([]);
  const [error, setError] = useState<string | null>(null);

  const MAX_MB = 5;
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    link_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user?.id) {
          if (isMounted) {
            setTools([]);
            setBanners([]);
            setError("Authentication required to manage banners.");
            setLoading(false);
          }
          return;
        }

        const { data: toolRows, error: toolRowsError } = await supabase
          .from("vendor_purchased_tools")
          .select("tool_name, status, expiry_date")
          .eq("vendor_id", user.id);

        if (!isMounted) return;
        if (toolRowsError) {
          console.error("VendorBannersPage toolRows error:", toolRowsError);
          throw toolRowsError;
        }
        console.log("VendorBannersPage tools:", { count: (toolRows || []).length });
        setTools((toolRows || []) as VendorToolRow[]);

        const { data: bannerRows, error: bannerError } = await supabase
          .from("sponsored_banners")
          .select("id, vendor_id, title, image_url, link_url, status, created_at")
          .eq("vendor_id", user.id)
          .order("created_at", { ascending: false });

        if (bannerError) {
          // A failed banner fetch should not break the whole page.
          // If it's truly an entitlement/permission issue, we can still show the banner section as empty.
          console.error("VendorBannersPage bannerRows error:", bannerError);
          if (!isMounted) return;
          setBanners([]);
        } else {
          if (!isMounted) return;
          console.log("VendorBannersPage banners:", { count: (bannerRows || []).length });
          setBanners((bannerRows || []) as SponsoredBanner[]);
        }
      } catch (e) {
        console.error("VendorBannersPage load error:", e);
        if (isMounted) setError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const canManagePromotions = useMemo(() => {
    const activeTools = new Set(
      tools.filter((t) => isToolActive(t)).map((t) => t.tool_name)
    );
    return (
      activeTools.has("Sponsored Banners") ||
      activeTools.has("Brand Promotion") ||
      activeTools.has("Marketing Tools")
    );
  }, [tools]);

  const validateBannerImageFile = (file: File) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedMimeTypes.includes(file.type)) return "Please upload a JPG, PNG, or WebP image.";

    const maxBytes = MAX_MB * 1024 * 1024;
    if (file.size > maxBytes) return `Image must be under ${MAX_MB}MB.`;
    return null;
  };

  const extractMenuImagesPath = (imageUrl: string): string | null => {
    // Typical Supabase public URL:
    // https://<project>.supabase.co/storage/v1/object/public/menu-images/<path...>
    const marker = "/menu-images/";
    const idx = imageUrl.indexOf(marker);
    if (idx === -1) return null;
    return imageUrl.slice(idx + marker.length);
  };

  const uploadBannerImageToStorage = async (file: File, _vendorId: string) => {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.access_token) {
      throw new Error("Please sign in again to upload images.");
    }
    const { publicUrl } = await uploadImageViaApi({
      file,
      purpose: "sponsored_banner",
      accessToken: session.access_token,
    });
    return publicUrl;
  };

  const setFileAndPreview = (file: File | null) => {
    if (!file) {
      setImageFile(null);
      setImagePreviewUrl(null);
      return;
    }

    const validationError = validateBannerImageFile(file);
    if (validationError) {
      alert(validationError);
      return;
    }

    setImageFile(file);
    const preview = URL.createObjectURL(file);
    setImagePreviewUrl(preview);
  };

  useEffect(() => {
    // Prevent memory leaks from `URL.createObjectURL`.
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const reloadBannersForVendor = async (vendorId: string) => {
    const { data: bannerRows, error: bannerError } = await supabase
      .from("sponsored_banners")
      .select("id, vendor_id, title, image_url, link_url, status, created_at")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false });

    if (bannerError) throw bannerError;
    setBanners((bannerRows || []) as SponsoredBanner[]);
  };

  const handleSaveBanner = async () => {
    try {
      setSaving(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        setError("Authentication required to save banners.");
        return;
      }

      const vendorId = user.id;
      const isReplace = !!editingBannerId;

      if (!isReplace && !imageFile) {
        alert("Please upload a banner image.");
        return;
      }

      let imageUrlToSave: string | null = null;
      if (imageFile) {
        setUploadingImage(true);
        imageUrlToSave = await uploadBannerImageToStorage(imageFile, vendorId);
      }

      const payload: Partial<SponsoredBanner> = {
        title: form.title.trim() || null,
        link_url: form.link_url.trim() || `/vendors/profile/${vendorId}`,
      };

      if (imageUrlToSave) payload.image_url = imageUrlToSave;

      if (!isReplace) {
        payload.vendor_id = vendorId;
        payload.status = "active";
      }

      if (isReplace) {
        if (!editingBannerId) return;
        const bannerId = editingBannerId;
        const { error: updateError } = await supabase
          .from("sponsored_banners")
          .update(payload)
          .eq("id", bannerId)
          .eq("vendor_id", vendorId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("sponsored_banners").insert({
          vendor_id: vendorId,
          title: payload.title ?? null,
          image_url: payload.image_url!,
          link_url: payload.link_url ?? `/vendors/profile/${vendorId}`,
          status: payload.status ?? "active",
        });

        if (insertError) throw insertError;
      }

      await reloadBannersForVendor(vendorId);

      setEditingBannerId(null);
      setImageFile(null);
      setImagePreviewUrl(null);
      setForm({ title: "", link_url: "" });
      alert(isReplace ? "Banner updated successfully." : "Banner created successfully.");
    } catch (e) {
      console.error("Save banner error:", e);
      alert(e instanceof Error ? e.message : "Failed to save banner");
    } finally {
      setSaving(false);
      setUploadingImage(false);
    }
  };

  const handleDeleteBanner = async (bannerId: string) => {
    try {
      setSaving(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        setError("Authentication required to delete banners.");
        return;
      }

      const vendorId = user.id;

      const banner = banners.find((b) => b.id === bannerId);
      if (banner?.image_url) {
        const storagePath = extractMenuImagesPath(banner.image_url);
        if (storagePath) {
          try {
            await supabase.storage.from("menu-images").remove([storagePath]);
          } catch (err) {
            console.warn("Banner storage delete failed (non-fatal):", err);
          }
        }
      }

      const { error: deleteError } = await supabase
        .from("sponsored_banners")
        .delete()
        .eq("id", bannerId)
        .eq("vendor_id", vendorId);

      if (deleteError) throw deleteError;

      setBanners((prev) => prev.filter((b) => b.id !== bannerId));
      if (editingBannerId === bannerId) setEditingBannerId(null);
    } catch (e) {
      console.error("Delete banner error:", e);
      alert(e instanceof Error ? e.message : "Failed to delete banner");
    } finally {
      setSaving(false);
    }
  };

  const toggleBannerStatus = async (bannerId: string, nextStatus: "active" | "inactive") => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        setError("Authentication required to update banner status.");
        return;
      }

      const vendorId = user.id;
      const { error: updateError } = await supabase
        .from("sponsored_banners")
        .update({ status: nextStatus })
        .eq("id", bannerId)
        .eq("vendor_id", vendorId);
      if (updateError) throw updateError;

      setBanners((prev) =>
        prev.map((b) => (b.id === bannerId ? { ...b, status: nextStatus } : b))
      );
    } catch (e) {
      console.error("toggleBannerStatus error:", e);
      alert(e instanceof Error ? e.message : "Failed to update banner");
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-[240px] flex items-center justify-center bg-hospineil-base-bg rounded-2xl">
        <Loader2 className="h-8 w-8 animate-spin text-hospineil-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-hospineil-light-bg rounded-2xl border border-gray-200">
        <CardHeader>
          <CardTitle className="font-header text-hospineil-primary">Promotions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 font-body">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200">
      <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <CardTitle className="font-header text-2xl text-hospineil-primary flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Promotions & Sponsored Banners
          </CardTitle>
          <p className="text-gray-600 font-body mt-2">
            Create, manage, and activate homepage sponsored promotions.
          </p>
        </div>
        {!canManagePromotions && (
          <Button
            className="bg-hospineil-primary text-white font-button rounded-full"
            onClick={() => router.push("/vendor/subscription")}
          >
            <ShieldCheck className="h-4 w-4 mr-2" />
            Activate a tool
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {!canManagePromotions ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-hospineil-base-bg px-6 py-10 text-center">
            <p className="text-gray-700 font-body font-medium mb-1">
              Sponsored promotions are locked.
            </p>
            <p className="text-sm text-gray-500 font-body">
              Activate <b>Sponsored Banners</b>, <b>Brand Promotion</b>, or{" "}
              <b>Marketing Tools</b> from your Premium Tools page.
            </p>
            <div className="mt-5">
              <Button
                className="bg-hospineil-primary text-white font-button rounded-full hover:bg-hospineil-primary/90"
                onClick={() => router.push("/vendor/subscription")}
              >
                Go to Premium Tools
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-body">Banner Title (optional)</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. This week’s offer"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-body">Link URL (optional)</Label>
                <Input
                  value={form.link_url}
                  onChange={(e) => setForm((p) => ({ ...p, link_url: e.target.value }))}
                  placeholder={`/vendors/profile/${"your-id"}`}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="font-body">Upload Banner Image</Label>

                <div
                  className="relative rounded-xl border-2 border-dashed border-gray-200 bg-white/70 p-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-hospineil-primary/60 transition-colors"
                  onClick={() => {
                    const el = document.getElementById("banner-image-input") as HTMLInputElement | null;
                    el?.click();
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0] ?? null;
                    if (file) setFileAndPreview(file);
                  }}
                >
                  <Upload className="h-5 w-5 text-hospineil-primary" />
                  <p className="text-sm font-body text-gray-700 text-center">
                    Drag & drop an image here, or click to browse.
                    <br />
                    <span className="text-xs text-gray-500">
                      JPG / PNG / WebP up to {MAX_MB}MB
                    </span>
                  </p>

                  <input
                    id="banner-image-input"
                    type="file"
                    accept={IMAGE_FILE_INPUT_ACCEPT}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setFileAndPreview(file);
                    }}
                  />
                </div>

                {imagePreviewUrl && (
                  <div className="mt-4">
                    <Label className="font-body">Preview</Label>
                    <div className="relative w-full h-48 rounded-xl overflow-hidden border border-gray-200 mt-2 bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreviewUrl}
                        alt="Banner preview"
                        className="object-cover w-full h-full"
                      />
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setFileAndPreview(null)}
                        disabled={saving}
                      >
                        Clear
                      </Button>
                      <span className="text-xs text-gray-500 font-body">
                        {imageFile ? `${Math.round(imageFile.size / 1024)} KB selected` : ""}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Button
                className="bg-hospineil-primary text-white font-button rounded-full hover:bg-hospineil-primary/90"
                onClick={() => void handleSaveBanner()}
                disabled={saving || uploadingImage}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  editingBannerId ? "Save Changes" : "Create Banner"
                )}
              </Button>

              {editingBannerId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingBannerId(null);
                    setFileAndPreview(null);
                    setForm({ title: "", link_url: "" });
                  }}
                  disabled={saving}
                >
                  Cancel Replace
                </Button>
              )}
            </div>

            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 font-header mb-3">
                Your Banners
              </h3>
              {banners.length === 0 ? (
                <p className="text-gray-600 font-body">
                  You haven’t created any banners yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {banners.map((b) => (
                    <div
                      key={b.id}
                      className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"
                    >
                      <div className="relative w-full h-36 bg-gray-100">
                        <img src={b.image_url} alt={b.title || "Banner"} className="object-cover w-full h-full" />
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-header font-semibold text-gray-900 truncate">
                              {b.title || "Sponsored promotion"}
                            </p>
                            <p className="text-xs text-gray-500 font-body">
                              {new Date(b.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              b.status === "active"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {b.status === "active" ? "Active" : "Inactive"}
                          </span>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          {b.status !== "active" ? (
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                              onClick={() => void toggleBannerStatus(b.id, "active")}
                            >
                              Activate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg"
                              onClick={() => void toggleBannerStatus(b.id, "inactive")}
                            >
                              Deactivate
                            </Button>
                          )}

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-lg border-hospineil-primary/30 text-hospineil-primary hover:bg-hospineil-primary/10"
                            onClick={() => {
                              setEditingBannerId(b.id);
                              setForm({
                                title: b.title || "",
                                link_url: b.link_url || "",
                              });
                              // Replacement image is optional; if omitted, Replace only updates text fields.
                              setFileAndPreview(null);
                            }}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Replace
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="rounded-lg"
                            onClick={() => void handleDeleteBanner(b.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

