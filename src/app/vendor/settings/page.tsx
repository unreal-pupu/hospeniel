"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, CheckCircle2, XCircle, Image as ImageIcon, Plus, X } from "lucide-react";
import Image from "next/image";
import { VENDOR_LOCATIONS } from "@/lib/vendorLocations";
import { VENDOR_CATEGORIES } from "@/lib/vendorCategories";

const LOCATIONS = VENDOR_LOCATIONS;
const CATEGORIES = VENDOR_CATEGORIES;

interface VendorSettings {
  business_name: string;
  email: string;
  phone_number: string;
  location: string;
  category: string;
  description: string;
  image_url: string | null;
  is_open: boolean;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  address: string;
}

interface VendorData {
  business_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone_number?: string | null;
  location?: string | null;
  category?: string | null;
  description?: string | null;
  image_url?: string | null;
  is_open?: boolean;
  delivery_enabled?: boolean;
  pickup_enabled?: boolean;
  address?: string | null;
  [key: string]: unknown;
}

interface Bank {
  id: number;
  name: string;
  code: string;
  longcode?: string;
  gateway?: string;
  pay_with_bank?: boolean;
  active?: boolean;
  is_deleted?: boolean;
  country?: string;
  currency?: string;
  type?: string;
  slug?: string;
}

export default function VendorSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState("free_trial");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specialtyInput, setSpecialtyInput] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [subaccountCode, setSubaccountCode] = useState<string | null>(null);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [creatingSubaccount, setCreatingSubaccount] = useState(false);

  const [settings, setSettings] = useState<VendorSettings>({
    business_name: "",
    email: "",
    phone_number: "",
    location: "",
    category: "",
    description: "",
    image_url: null,
    is_open: true,
    delivery_enabled: true,
    pickup_enabled: true,
    address: "",
  });

  function sanitizeSpecialty(value: string) {
    return value.trim().replace(/\s+/g, " ");
  }

  function normalizeCategory(value: string) {
    return value.toLowerCase().replace(/[\s-]+/g, "_");
  }

  const normalizedCategory = normalizeCategory(settings.category || "");
  const isChefOrHomeCook = normalizedCategory === "chef" || normalizedCategory === "home_cook";
  const isPremiumPlan = subscriptionPlan === "professional" || subscriptionPlan === "premium";
  const maxSpecialties = isPremiumPlan ? 10 : 4;
  const hasReachedSpecialtyLimit = specialties.length >= maxSpecialties;

  const handleAddSpecialty = () => {
    const nextValue = sanitizeSpecialty(specialtyInput);
    if (!nextValue || !isChefOrHomeCook || hasReachedSpecialtyLimit) return;
    if (specialties.some((value) => value.toLowerCase() === nextValue.toLowerCase())) {
      setSpecialtyInput("");
      return;
    }
    setSpecialties((prev) => [...prev, nextValue]);
    setSpecialtyInput("");
  };

  const handleRemoveSpecialty = (value: string) => {
    setSpecialties((prev) => prev.filter((item) => item !== value));
  };

  const populateSettings = useCallback((vendorData: VendorData, userEmail: string) => {
    const normalizedVendorCategory = vendorData.category
      ? normalizeCategory(vendorData.category)
      : "";
    setSettings({
      business_name: vendorData.business_name || vendorData.name || "",
      email: vendorData.email || userEmail || "",
      phone_number: vendorData.phone_number || "",
      location: vendorData.location || "",
      category: normalizedVendorCategory,
      description: vendorData.description || "",
      image_url: vendorData.image_url || null,
      is_open: vendorData.is_open !== undefined ? vendorData.is_open : true,
      delivery_enabled: vendorData.delivery_enabled !== undefined ? vendorData.delivery_enabled : true,
      pickup_enabled: vendorData.pickup_enabled !== undefined ? vendorData.pickup_enabled : true,
      address: vendorData.address || "",
    });

    // Set image preview if image_url exists
    if (vendorData.image_url) {
      setImagePreview(vendorData.image_url);
    }
  }, []);

  const createVendorRecord = async (userId: string, email: string) => {
    try {
      // Get user's name from profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", userId)
        .single();

      const vendorName = profileData?.name || "Vendor";
      
      const { error } = await supabase
        .from("vendors")
        .insert([
          {
            profile_id: userId,
            name: vendorName, // Always set name field
            business_name: vendorName, // Use name as default business_name
            email: email,
            is_open: true,
            delivery_enabled: true,
            pickup_enabled: true,
          },
        ]);

      if (error) {
        console.error("Error creating vendor record:", error);
        throw error;
      }
    } catch (error) {
      console.error("Error in createVendorRecord:", error);
      throw error;
    }
  };

  const fetchVendorData = useCallback(async () => {
    try {
      setLoading(true);
      setMessage(null); // Clear any previous messages

      // Get authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error("Auth error:", userError);
        setMessage({ type: "error", text: "Please log in to access settings" });
        setTimeout(() => router.push("/loginpage"), 2000);
        setLoading(false);
        return;
      }

      setUserId(user.id);
      setProfileId(user.id); // profile_id in vendors table = auth.users.id

      // Fetch vendor data
      const { data: vendorData, error: vendorError } = await supabase
        .from("vendors")
        .select("*")
        .eq("profile_id", user.id)
        .single();

      if (vendorError) {
        console.error("Error fetching vendor data:", vendorError);
        // If vendor doesn't exist, create a basic record
        if (vendorError.code === "PGRST116") {
          setMessage({ type: "info", text: "Creating vendor profile..." });
          await createVendorRecord(user.id, user.email || "");
          // Fetch again after creating
          const { data: newVendorData } = await supabase
            .from("vendors")
            .select("*")
            .eq("profile_id", user.id)
            .single();
          
          if (newVendorData) {
            populateSettings(newVendorData, user.email || "");
          }
        } else {
          setMessage({ type: "error", text: "Failed to load vendor settings" });
        }
      } else if (vendorData) {
        populateSettings(vendorData, user.email || "");
      }

      // Also fetch profile for email and subaccount_code
      const { data: profileData } = await supabase
        .from("profiles")
        .select("email, subaccount_code, subscription_plan, category")
        .eq("id", user.id)
        .single();
      
      if (profileData) {
        if (profileData.email && (!vendorData || !vendorData.email)) {
          setSettings(prev => ({ ...prev, email: profileData.email }));
        }
        if (profileData.subaccount_code) {
          setSubaccountCode(profileData.subaccount_code);
        }
        if ((!vendorData || !vendorData.category) && profileData.category) {
          setSettings(prev => ({ ...prev, category: normalizeCategory(profileData.category || "") }));
        }
        setSubscriptionPlan(profileData.subscription_plan || "free_trial");
      }

      const activeCategory = normalizeCategory(
        vendorData?.category || profileData?.category || ""
      );
      const isChefOrHomeCook = activeCategory === "chef" || activeCategory === "home_cook";
      if (isChefOrHomeCook) {
        const { data: serviceProfileData, error: serviceProfileError } = await supabase
          .from("vendor_service_profiles")
          .select("specialties")
          .eq("profile_id", user.id)
          .maybeSingle();

        if (serviceProfileError) {
          console.error("Error loading service profile specialties:", serviceProfileError);
        }

        const initialSpecialties = (serviceProfileData?.specialties || [])
          .map((value: string) => sanitizeSpecialty(value))
          .filter(Boolean);
        setSpecialties(initialSpecialties);
      }
    } catch (error) {
      console.error("Error fetching vendor data:", error);
      const errorMessage = error instanceof Error ? error.message : "An error occurred while loading settings. Please try refreshing the page.";
      setMessage({ 
        type: "error", 
        text: errorMessage
      });
    } finally {
      setLoading(false);
    }
  }, [router, populateSettings]);

  const fetchBanks = useCallback(async () => {
    try {
      setLoadingBanks(true);
      const res = await fetch("/api/banks");
      const data = await res.json();
      
      if (data.success && data.banks && Array.isArray(data.banks)) {
        // Filter only active banks that support pay_with_bank
        // Also include banks that don't have pay_with_bank set (some banks might not have this field)
        const activeBanks = data.banks.filter(
          (bank: Bank) => bank.active !== false && (bank.pay_with_bank !== false)
        );
        
        // Sort banks alphabetically by name
        activeBanks.sort((a: Bank, b: Bank) => a.name.localeCompare(b.name));
        
        setBanks(activeBanks);
        console.log(`✅ Loaded ${activeBanks.length} banks from ${data.source || 'Paystack'}`);
      } else {
        console.error("Failed to fetch banks:", data.error || "Unknown error");
        // Set empty array to prevent errors
        setBanks([]);
      }
    } catch (error) {
      console.error("Error fetching banks:", error);
      // Set empty array to prevent errors
      setBanks([]);
    } finally {
      setLoadingBanks(false);
    }
  }, []);

  useEffect(() => {
    fetchVendorData();
    fetchBanks();
  }, [fetchVendorData, fetchBanks]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setMessage({ type: "error", text: "Please select a valid image file" });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: "error", text: "Image size must be less than 5MB" });
        return;
      }

      setImageFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);

      if (!userId) {
        throw new Error("User not authenticated");
      }

      // Verify session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session || !session.access_token) {
        throw new Error("Session is invalid. Please log in again.");
      }

      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Delete old image if exists
      if (settings.image_url && settings.image_url.includes("vendor-images")) {
        try {
          // Extract the file path from the URL
          // URL format: https://[project].supabase.co/storage/v1/object/public/vendor-images/[path]
          const urlParts = settings.image_url.split("/vendor-images/");
          if (urlParts.length > 1) {
            const oldFilePath = urlParts[1];
            await supabase.storage
              .from("vendor-images")
              .remove([oldFilePath]);
          }
        } catch (error) {
          console.warn("Error deleting old image:", error);
          // Continue even if deletion fails
        }
      }

      // Upload to Supabase Storage (vendor-images bucket)
      const { error: uploadError } = await supabase.storage
        .from("vendor-images")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        
        if (uploadError.message?.includes("not found") || uploadError.message?.includes("Bucket")) {
          throw new Error("Storage bucket 'vendor-images' not found. Please create it in Supabase Storage settings.");
        }
        if (uploadError.message?.includes("row-level security") || uploadError.message?.includes("RLS")) {
          throw new Error("Storage upload denied by security policy. Please check RLS policies.");
        }
        
        throw new Error(`Upload failed: ${uploadError.message || "Unknown error"}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("vendor-images")
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      if (!userId || !profileId) {
        setMessage({ type: "error", text: "Please log in to save settings" });
        return;
      }

      // Validate required fields
      if (!settings.business_name.trim()) {
        setMessage({ type: "error", text: "Business name is required" });
        return;
      }

      if (!settings.email.trim()) {
        setMessage({ type: "error", text: "Email is required" });
        return;
      }

      if (!settings.location) {
        setMessage({ type: "error", text: "Location is required" });
        return;
      }

      // Upload image if a new one was selected
      let imageUrl = settings.image_url;
      if (imageFile) {
        try {
          imageUrl = await uploadImage(imageFile);
          if (!imageUrl) {
            setMessage({ type: "error", text: "Failed to upload image" });
            return;
          }
          setMessage({ type: "success", text: "Image uploaded successfully" });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Failed to upload image";
          setMessage({ type: "error", text: errorMessage });
          return;
        }
      }

      // Update vendor record
      // Build update data object, only including fields that have values
      // Always set name to match business_name to satisfy NOT NULL constraint
      const businessName = settings.business_name.trim() || "Vendor";
      interface UpdateData {
        name: string;
        business_name?: string;
        email?: string;
        phone_number?: string;
        location?: string;
        category?: string;
        description?: string;
        image_url?: string | null;
        is_open?: boolean;
        delivery_enabled?: boolean;
        pickup_enabled?: boolean;
        address?: string;
        [key: string]: unknown;
      }
      const updateData: UpdateData = {
        name: businessName, // Always set name field (required by schema)
        business_name: businessName,
      };

      // Only add optional fields if they have values or are being explicitly set
      if (settings.email?.trim()) {
        updateData.email = settings.email.trim();
      }
      if (settings.phone_number?.trim()) {
        updateData.phone_number = settings.phone_number.trim();
      }
      if (settings.location) {
        updateData.location = settings.location;
      }
      if (settings.category) {
        updateData.category = settings.category;
      }
      if (settings.description?.trim()) {
        updateData.description = settings.description.trim();
      }
      if (imageUrl !== null && imageUrl !== undefined) {
        updateData.image_url = imageUrl;
      }
      if (settings.address?.trim()) {
        updateData.address = settings.address.trim();
      }
      
      // Boolean fields
      updateData.is_open = settings.is_open !== undefined ? settings.is_open : true;
      updateData.delivery_enabled = settings.delivery_enabled !== undefined ? settings.delivery_enabled : true;
      updateData.pickup_enabled = settings.pickup_enabled !== undefined ? settings.pickup_enabled : true;

      console.log("Updating vendor with data:", updateData);

      const { error: updateError } = await supabase
        .from("vendors")
        .update(updateData)
        .eq("profile_id", profileId);

      if (updateError) {
        console.error("Error updating vendor:", updateError);
        console.error("Update data:", updateData);
        
        if (updateError.message?.includes("row-level security") || updateError.message?.includes("RLS")) {
          setMessage({ type: "error", text: "Update denied. Please check that you have permission to update your vendor profile." });
        } else if (updateError.message?.includes("schema cache") || updateError.message?.includes("column")) {
          setMessage({ 
            type: "error", 
            text: "Database schema issue detected. Please ensure all migrations have been run. Contact support if this persists." 
          });
        } else {
          setMessage({ type: "error", text: `Failed to update settings: ${updateError.message || "Unknown error"}` });
        }
        return;
      }

      // Also update profile location/category to keep profiles as source of truth
      if (settings.location || settings.category) {
        const profileUpdates: { location?: string; category?: string } = {};
        if (settings.location) {
          profileUpdates.location = settings.location;
        }
        if (settings.category) {
          profileUpdates.category = settings.category;
        }
        await supabase
          .from("profiles")
          .update(profileUpdates)
          .eq("id", userId);
      }

      // If chef/home cook, sync description/image to vendor_service_profiles
      const isChefOrHomeCook =
        normalizedCategory === "chef" || normalizedCategory === "home_cook";
      if (isChefOrHomeCook) {
        const { data: existingServiceProfile, error: serviceProfileError } = await supabase
          .from("vendor_service_profiles")
          .select("profile_id, pricing_model, base_price, service_mode, specialties, bio, image_url")
          .eq("profile_id", userId)
          .maybeSingle();

        if (serviceProfileError) {
          console.error("Error loading service profile for sync:", serviceProfileError);
        }

        const specialtiesList = specialties
          .map((value) => sanitizeSpecialty(value))
          .filter(Boolean);
        const serviceProfilePayload = {
          profile_id: userId,
          pricing_model: existingServiceProfile?.pricing_model || "per_meal",
          base_price: existingServiceProfile?.base_price || 0,
          service_mode: existingServiceProfile?.service_mode || [],
          specialties: specialtiesList,
          bio: settings.description?.trim() || existingServiceProfile?.bio || "",
          image_url: imageUrl ?? (existingServiceProfile?.image_url || null),
        };

        const { error: serviceProfileUpsertError } = await supabase
          .from("vendor_service_profiles")
          .upsert(serviceProfilePayload, { onConflict: "profile_id" });

        if (serviceProfileUpsertError) {
          console.error("Error syncing service profile:", serviceProfileUpsertError);
        } else if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("vendor-service-profile-updated", {
            detail: { profile_id: userId, source: "vendor-settings" },
          }));
        }
      }

      setMessage({ type: "success", text: "Settings saved successfully!" });
      setImageFile(null); // Clear image file after successful save
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
      
      // Refresh data
      await fetchVendorData();
    } catch (error) {
      console.error("Error saving settings:", error);
      const errorMessage = error instanceof Error ? error.message : "An error occurred while saving settings";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSubaccount = async () => {
    try {
      if (!userId) {
        setMessage({ type: "error", text: "Please log in to create subaccount" });
        return;
      }

      if (!bankCode) {
        setMessage({ type: "error", text: "Please select a bank" });
        return;
      }

      if (!accountNumber || accountNumber.length < 10) {
        setMessage({ type: "error", text: "Please enter a valid account number (at least 10 digits)" });
        return;
      }

      if (!settings.business_name.trim()) {
        setMessage({ type: "error", text: "Business name is required" });
        return;
      }

      setCreatingSubaccount(true);

      const res = await fetch("/api/create-subaccount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          business_name: settings.business_name.trim(),
          bank_code: bankCode,
          account_number: accountNumber,
          percentage_charge: 10, // Hospineil keeps 10% commission
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage({ type: "error", text: data.error || "Failed to create subaccount" });
        return;
      }

      setSubaccountCode(data.subaccount_code);
      setMessage({ type: "success", text: "✅ Paystack subaccount created successfully!" });
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
      
      // Refresh data to get updated subaccount_code
      await fetchVendorData();
    } catch (error) {
      console.error("Error creating subaccount:", error);
      const errorMessage = error instanceof Error ? error.message : "An error occurred while creating subaccount";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setCreatingSubaccount(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full flex flex-col items-center justify-center min-h-[400px] bg-hospineil-base-bg">
        <Loader2 className="animate-spin text-hospineil-primary h-8 w-8 mb-4" />
        <p className="text-gray-600 font-body">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-hospineil-primary mb-2 font-header">Vendor Settings</h1>
        <p className="text-gray-600 font-body">Manage your business profile and settings</p>
      </div>

      {/* Message Notification */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-2xl shadow-md ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : message.type === "error"
              ? "bg-red-50 text-red-800 border border-red-200"
              : "bg-blue-50 text-blue-800 border border-blue-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-body">{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Section - Profile Image and Basic Info */}
        <div className="lg:col-span-1">
          <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200">
            <CardHeader>
              <CardTitle className="text-hospineil-primary font-header">Profile Image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Image Preview */}
              <div className="flex flex-col items-center">
                  <div className="relative w-48 h-48 rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-100">
                  {imagePreview ? (
                    <Image
                      src={imagePreview}
                      alt="Vendor profile"
                      fill
                      className="object-cover"
                      sizes="192px"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-16 h-16 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Upload Button */}
                <div className="mt-4">
                  <label
                    htmlFor="image-upload"
                    className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-hospineil-primary text-white rounded-lg hover:bg-hospineil-primary/90 hover:scale-105 transition-all font-button"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>Upload Image</span>
                      </>
                    )}
                  </label>
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    disabled={uploading}
                  />
                </div>

                <p className="text-sm text-gray-500 text-center mt-2 font-body">
                  Recommended: Square image, max 5MB
                </p>
              </div>

              {/* Status Indicators */}
              <div className="pt-4 border-t border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 font-body">Status</span>
                  <div className="flex items-center gap-2">
                    {settings.is_open ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-600 font-medium font-body">Open</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-red-600 font-medium font-body">Closed</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Section - Editable Form Fields */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200">
            <CardHeader>
              <CardTitle className="text-hospineil-primary font-header">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="business_name" className="font-body text-gray-700">Business Name *</Label>
                  <Input
                    id="business_name"
                    value={settings.business_name}
                    onChange={(e) =>
                      setSettings({ ...settings, business_name: e.target.value })
                    }
                    placeholder="Enter your business name"
                    required
                    className="bg-hospineil-base-bg border-gray-300 focus:ring-hospineil-primary focus:border-hospineil-primary font-body"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="font-body text-gray-700">Contact Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={settings.email}
                    onChange={(e) =>
                      setSettings({ ...settings, email: e.target.value })
                    }
                    placeholder="your@email.com"
                    required
                    className="bg-hospineil-base-bg border-gray-300 focus:ring-hospineil-primary focus:border-hospineil-primary font-body"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone_number" className="font-body text-gray-700">Phone Number</Label>
                  <Input
                    id="phone_number"
                    type="tel"
                    value={settings.phone_number}
                    onChange={(e) =>
                      setSettings({ ...settings, phone_number: e.target.value })
                    }
                    placeholder="+234 123 456 7890"
                    className="bg-hospineil-base-bg border-gray-300 focus:ring-hospineil-primary focus:border-hospineil-primary font-body"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location" className="font-body text-gray-700">Location *</Label>
                  <Select
                    value={settings.location}
                    onValueChange={(value) =>
                      setSettings({ ...settings, location: value })
                    }
                  >
                    <SelectTrigger id="location" className="bg-hospineil-base-bg border-gray-300 focus:ring-hospineil-primary focus:border-hospineil-primary font-body">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent className="bg-white rounded-lg shadow-lg border border-gray-200">
                      {LOCATIONS.map((loc) => (
                        <SelectItem key={loc} value={loc} className="font-body hover:bg-gray-100">
                          {loc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category" className="font-body text-gray-700">Business Category</Label>
                <Select
                  value={settings.category}
                  onValueChange={(value) =>
                    setSettings({ ...settings, category: value })
                  }
                >
                  <SelectTrigger id="category" className="bg-hospineil-base-bg border-gray-300 focus:ring-hospineil-primary focus:border-hospineil-primary font-body">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-white rounded-lg shadow-lg border border-gray-200">
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value} className="font-body hover:bg-gray-100">
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="font-body text-gray-700">Business Address</Label>
                <Input
                  id="address"
                  value={settings.address}
                  onChange={(e) =>
                    setSettings({ ...settings, address: e.target.value })
                  }
                  placeholder="Enter your business address"
                  className="bg-hospineil-base-bg border-gray-300 focus:ring-hospineil-primary focus:border-hospineil-primary font-body"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="font-body text-gray-700">Business Description</Label>
                <Textarea
                  id="description"
                  value={settings.description}
                  onChange={(e) =>
                    setSettings({ ...settings, description: e.target.value })
                  }
                  placeholder="Tell customers about your business..."
                  rows={4}
                  className="bg-hospineil-base-bg border-gray-300 focus:ring-hospineil-primary focus:border-hospineil-primary font-body"
                />
              </div>

              {isChefOrHomeCook && (
                <div className="space-y-2">
                  <Label htmlFor="specialties" className="font-body text-gray-700">Specialties</Label>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Input
                        id="specialties"
                        value={specialtyInput}
                        onChange={(e) => setSpecialtyInput(e.target.value)}
                        placeholder="e.g. Nigerian soups"
                        className="bg-hospineil-base-bg border-gray-300 focus:ring-hospineil-primary focus:border-hospineil-primary font-body"
                        disabled={hasReachedSpecialtyLimit}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddSpecialty}
                        disabled={hasReachedSpecialtyLimit || !specialtyInput.trim()}
                        className="px-3"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 font-body">
                      {isPremiumPlan
                        ? "Premium plan: up to 10 specialties"
                        : "Starter plan: up to 4 specialties"}
                    </p>
                    {specialties.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {specialties.map((item) => (
                          <span
                            key={item}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-hospineil-light-bg text-gray-700 text-xs rounded-full font-body"
                          >
                            {item}
                            <button
                              type="button"
                              onClick={() => handleRemoveSpecialty(item)}
                              className="text-gray-500 hover:text-gray-700"
                              aria-label={`Remove ${item}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Business Settings */}
          <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200">
            <CardHeader>
              <CardTitle className="text-hospineil-primary font-header">Business Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-hospineil-base-bg">
                <div>
                  <Label htmlFor="is_open" className="text-base font-medium font-body text-gray-700">
                    Accept Orders
                  </Label>
                  <p className="text-sm text-gray-500 font-body">
                    Toggle to open/close your store for orders
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="is_open"
                    checked={settings.is_open}
                    onChange={(e) =>
                      setSettings({ ...settings, is_open: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-hospineil-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-hospineil-primary"></div>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-hospineil-base-bg">
                  <div>
                    <Label htmlFor="delivery_enabled" className="text-base font-medium font-body text-gray-700">
                      Delivery
                    </Label>
                    <p className="text-sm text-gray-500 font-body">Enable delivery service</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="delivery_enabled"
                      checked={settings.delivery_enabled}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          delivery_enabled: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-hospineil-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-hospineil-primary"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-hospineil-base-bg">
                  <div>
                    <Label htmlFor="pickup_enabled" className="text-base font-medium font-body text-gray-700">
                      Pickup
                    </Label>
                    <p className="text-sm text-gray-500 font-body">Enable pickup service</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="pickup_enabled"
                      checked={settings.pickup_enabled}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          pickup_enabled: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-hospineil-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-hospineil-primary"></div>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bank Details & Paystack Subaccount */}
          <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200">
            <CardHeader>
              <CardTitle className="text-hospineil-primary font-header">Payment Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {subaccountCode ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-800 font-body">Paystack Subaccount Active</span>
                  </div>
                  <p className="text-sm text-green-700 font-body">
                    Your subaccount code: <span className="font-mono font-semibold">{subaccountCode}</span>
                  </p>
                  <p className="text-xs text-green-600 mt-2 font-body">
                    You will receive 90% of payments automatically. Hospineil retains 10% commission.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800 font-body">
                      <strong>Payment Setup Required:</strong> Please add your bank details to receive payments. 
                      Once set up, you&apos;ll automatically receive 90% of each payment, with Hospineil retaining 10% commission.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="bank" className="font-body text-gray-700">Bank Name *</Label>
                      <Select
                        value={bankCode}
                        onValueChange={(value) => {
                          setBankCode(value);
                          console.log("Selected bank code:", value);
                        }}
                        disabled={loadingBanks || creatingSubaccount}
                      >
                        <SelectTrigger 
                          id="bank" 
                          className="w-full bg-hospineil-base-bg border-gray-300 focus:ring-hospineil-primary focus:border-hospineil-primary font-body"
                        >
                          <SelectValue placeholder={loadingBanks ? "Loading banks..." : banks.length > 0 ? "Select your bank" : "No banks available"} />
                        </SelectTrigger>
                        <SelectContent className="bg-white rounded-lg shadow-lg border border-gray-200 max-h-[300px] overflow-y-auto">
                          {banks.length > 0 ? (
                            banks.map((bank) => (
                              <SelectItem 
                                key={bank.code} 
                                value={bank.code} 
                                className="font-body hover:bg-gray-100 cursor-pointer"
                              >
                                {bank.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-banks" disabled className="font-body text-gray-400">
                              No banks available
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      {loadingBanks && (
                        <p className="text-xs text-gray-500 font-body">Loading banks...</p>
                      )}
                      {!loadingBanks && banks.length === 0 && (
                        <p className="text-xs text-yellow-600 font-body">Unable to load banks. Please refresh the page or contact support.</p>
                      )}
                      {!loadingBanks && banks.length > 0 && (
                        <p className="text-xs text-gray-500 font-body">{banks.length} banks available</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="accountNumber" className="font-body text-gray-700">Account Number *</Label>
                      <Input
                        id="accountNumber"
                        type="text"
                        value={accountNumber}
                        onChange={(e) => {
                          // Only allow digits
                          const value = e.target.value.replace(/\D/g, "");
                          setAccountNumber(value);
                        }}
                        placeholder="Enter your account number"
                        minLength={10}
                        disabled={creatingSubaccount}
                        className="bg-hospineil-base-bg border-gray-300 focus:ring-hospineil-primary focus:border-hospineil-primary font-body"
                      />
                      <p className="text-xs text-gray-500 font-body">Enter your account number (minimum 10 digits)</p>
                    </div>

                    <Button
                      onClick={handleCreateSubaccount}
                      disabled={creatingSubaccount || !bankCode || !accountNumber || accountNumber.length < 10 || !settings.business_name.trim()}
                      className="w-full bg-hospineil-accent text-hospineil-light-bg hover:bg-hospineil-accent-hover transition-all font-button"
                    >
                      {creatingSubaccount ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating Subaccount...
                        </>
                      ) : (
                        "Create Paystack Subaccount"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving || uploading}
              className="px-8 py-2 bg-hospineil-primary text-white hover:bg-hospineil-primary/90 hover:scale-105 transition-all font-button"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
