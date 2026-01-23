"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Star, StarOff, Upload } from "lucide-react";
import Image from "next/image";

interface Vendor {
  id: string;
  name: string;
  email: string;
  category: string | null;
  location: string | null;
  is_featured: boolean;
  featured_description: string | null;
  featured_image: string | null;
  created_at: string;
}

export default function FeaturedVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "vendor")
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error("Error fetching vendors:", error);
      alert("Failed to fetch vendors");
    } finally {
      setLoading(false);
    }
  };

  const getAdminAccessToken = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.access_token) {
      throw new Error("Admin session not found. Please log in again.");
    }
    return session.access_token;
  };

  const updateFeaturedVendor = async (payload: {
    id: string;
    is_featured?: boolean;
    featured_description?: string | null;
    featured_image?: string | null;
  }) => {
    const token = await getAdminAccessToken();
    const response = await fetch("/api/admin/featured-vendors", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error || "Failed to update featured vendor");
    }

    return response.json();
  };

  const handleToggleFeatured = async (vendor: Vendor) => {
    try {
      await updateFeaturedVendor({
        id: vendor.id,
        is_featured: !vendor.is_featured,
      });
      fetchVendors();
    } catch (error) {
      console.error("Error toggling featured status:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update featured status";
      alert(errorMessage);
    }
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor({ ...vendor });
  };

  const handleCancelEdit = () => {
    setEditingVendor(null);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingVendor || !event.target.files?.[0]) return;

    try {
      const file = event.target.files[0];
      const fileExt = file.name.split(".").pop();
      const fileName = `featured-${editingVendor.id}-${Date.now()}.${fileExt}`;
      const filePath = `featured-vendors/${fileName}`;

      // Upload to Supabase Storage (using a featured-vendors bucket)
      // If the bucket doesn't exist, we'll use a public URL or vendor's existing image
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Try to upload to storage, if it fails, we can use a public URL
      let imageUrl = editingVendor.featured_image;

      try {
        // Check if featured-vendors bucket exists, if not, use menu-images or avatars
        const { error: uploadError } = await supabase.storage
          .from("menu-images")
          .upload(filePath, file, { upsert: true });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("menu-images")
            .getPublicUrl(filePath);
          imageUrl = urlData.publicUrl;
        } else {
          // If upload fails, we can allow admins to paste a URL instead
          console.warn("Storage upload failed, using file reader as fallback");
          // For now, we'll use a data URL or allow URL input
          const reader = new FileReader();
          reader.onloadend = () => {
            // For production, you'd want to upload to a proper storage solution
            // For now, we'll allow URL input in the form
          };
          reader.readAsDataURL(file);
        }
      } catch (storageError) {
        console.error("Storage error:", storageError);
        // Allow manual URL input as fallback
      }

      if (imageUrl && editingVendor) {
        setEditingVendor({
          ...editingVendor,
          featured_image: imageUrl,
        });
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Failed to upload image. You can paste an image URL instead.");
    }
  };

  const handleSave = async () => {
    if (!editingVendor) return;

    try {
      setSaving(true);
      await updateFeaturedVendor({
        id: editingVendor.id,
        is_featured: editingVendor.is_featured,
        featured_description: editingVendor.featured_description || null,
        featured_image: editingVendor.featured_image || null,
      });
      setEditingVendor(null);
      fetchVendors();
    } catch (error) {
      console.error("Error saving vendor:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save changes";
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const filteredVendors = vendors.filter((vendor) =>
    vendor.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const featuredVendors = filteredVendors.filter((v) => v.is_featured);
  const nonFeaturedVendors = filteredVendors.filter((v) => !v.is_featured);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-indigo-600 h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Featured Vendors</h1>
          <p className="text-gray-600 mt-2">
            Manage featured vendors displayed on the landing page
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search vendors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {/* Featured Vendors Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              Featured Vendors ({featuredVendors.length})
            </h2>
            {featuredVendors.length === 0 ? (
              <p className="text-gray-500 text-sm">No featured vendors yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {featuredVendors.map((vendor) => (
                  <div
                    key={vendor.id}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    {editingVendor?.id === vendor.id ? (
                      <div className="space-y-4">
                        <div>
                          <Label>Featured Image URL</Label>
                          <div className="flex gap-2 mt-1">
                            <Input
                              value={editingVendor.featured_image || ""}
                              onChange={(e) =>
                                setEditingVendor({
                                  ...editingVendor,
                                  featured_image: e.target.value,
                                })
                              }
                              placeholder="Image URL"
                            />
                            <label className="cursor-pointer">
                              <Upload className="h-5 w-5 text-gray-600" />
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                              />
                            </label>
                          </div>
                          {editingVendor.featured_image && (
                            <div className="relative w-full h-32 mt-2 rounded overflow-hidden">
                              <Image
                                src={editingVendor.featured_image}
                                alt={editingVendor.name}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                          )}
                        </div>
                        <div>
                          <Label>Featured Description</Label>
                          <Textarea
                            value={editingVendor.featured_description || ""}
                            onChange={(e) =>
                              setEditingVendor({
                                ...editingVendor,
                                featured_description: e.target.value,
                              })
                            }
                            placeholder="Description for featured vendor"
                            rows={3}
                            className="mt-1"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={handleSave}
                            disabled={saving}
                            size="sm"
                            className="flex-1"
                          >
                            {saving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Save"
                            )}
                          </Button>
                          <Button
                            onClick={handleCancelEdit}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">
                              {vendor.name}
                            </h3>
                            <p className="text-sm text-gray-600">{vendor.email}</p>
                            {vendor.location && (
                              <p className="text-xs text-gray-500 mt-1">
                                {vendor.location}
                              </p>
                            )}
                          </div>
                          <Button
                            onClick={() => handleToggleFeatured(vendor)}
                            variant="ghost"
                            size="sm"
                            className="text-yellow-500 hover:text-yellow-600"
                          >
                            <Star className="h-5 w-5 fill-yellow-500" />
                          </Button>
                        </div>
                        {vendor.featured_image && (
                          <div className="relative w-full h-32 mb-3 rounded overflow-hidden">
                            <Image
                              src={vendor.featured_image}
                              alt={vendor.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        )}
                        {vendor.featured_description && (
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                            {vendor.featured_description}
                          </p>
                        )}
                        <Button
                          onClick={() => handleEdit(vendor)}
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          Edit Details
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Non-Featured Vendors Section */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <StarOff className="h-5 w-5 text-gray-400" />
              All Vendors ({nonFeaturedVendors.length})
            </h2>
            {nonFeaturedVendors.length === 0 ? (
              <p className="text-gray-500 text-sm">No vendors found.</p>
            ) : (
              <div className="space-y-2">
                {nonFeaturedVendors.map((vendor) => (
                  <div
                    key={vendor.id}
                    className="flex items-center justify-between border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{vendor.name}</h3>
                      <p className="text-sm text-gray-600">{vendor.email}</p>
                      {vendor.location && (
                        <p className="text-xs text-gray-500 mt-1">{vendor.location}</p>
                      )}
                    </div>
                    <Button
                      onClick={() => handleToggleFeatured(vendor)}
                      variant="outline"
                      size="sm"
                    >
                      <Star className="h-4 w-4 mr-2" />
                      Feature
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}




