"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Edit2, Trash2, Upload, X, Loader2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MenuItem {
  id: string;
  title: string;
  description: string | null;
  price: number;
  image_url: string | null;
  availability: boolean;
  vendor_id: string;
  created_at: string;
  vendors?: {
    id: string | null;
    name: string;
    image_url: string | null;
    location?: string | null;
    category?: string | null;
    is_premium?: boolean;
    subscription_plan?: string;
  };
}

export default function MenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState<string>("free_trial");
  
  // Form state
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    availability: true,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    fetchMenuItems();
    fetchSubscriptionPlan();
  }, []);

  const fetchSubscriptionPlan = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch subscription_plan from profiles table (primary source)
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_plan")
        .eq("id", user.id)
        .single();

      if (profile) {
        setSubscriptionPlan(profile.subscription_plan || "free_trial");
      } else {
        // Fallback to vendors table if profile not found
        const { data: vendor } = await supabase
          .from("vendors")
          .select("subscription_plan")
          .eq("profile_id", user.id)
          .single();

        if (vendor) {
          setSubscriptionPlan(vendor.subscription_plan || "free_trial");
        }
      }
    } catch (error) {
      console.error("Error fetching subscription plan:", error);
    }
  };

  const fetchMenuItems = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error("No authenticated user");
        setLoading(false);
        return;
      }

      // Fetch menu items
      const { data: menuData, error: menuError } = await supabase
        .from("menu_items")
        .select("*")
        .eq("vendor_id", user.id)
        .order("created_at", { ascending: false });

      if (menuError) {
        console.error("Error fetching menu items:", menuError);
        setLoading(false);
        return;
      }

      // Fetch vendor information from vendors table
      const { data: vendorData, error: vendorError } = await supabase
        .from("vendors")
        .select("id, name, business_name, image_url, location, profile_id, category, is_premium, subscription_plan")
        .eq("profile_id", user.id)
        .single();

      // Also fetch from profiles table for fallback
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, name, location, category, is_premium, subscription_plan")
        .eq("id", user.id)
        .eq("role", "vendor")
        .single();

      if (vendorError) {
        console.warn("Error fetching vendor data:", vendorError);
      }
      if (profileError) {
        console.warn("Error fetching profile data:", profileError);
      }

      // Priority order for vendor name:
      // 1. name from profiles table (PRIMARY SOURCE - where vendor names are stored)
      // 2. business_name from vendors table (fallback)
      // 3. name from vendors table (fallback)
      // 4. Only use fallback message if absolutely nothing is found
      let vendorName: string | null = null;
      
      // PRIMARY: Use profiles.name first (this is where vendor names are stored)
      if (profileData?.name && profileData.name.trim() !== "") {
        vendorName = profileData.name.trim();
      } else if (vendorData?.business_name && vendorData.business_name.trim() !== "") {
        vendorName = vendorData.business_name.trim();
      } else if (vendorData?.name && vendorData.name.trim() !== "") {
        vendorName = vendorData.name.trim();
      }
      
      // Only use fallback if we truly have no name
      if (!vendorName || vendorName === "") {
        console.error(`❌ CRITICAL: No vendor name found for vendor ${user.id}`);
        console.error(`Vendor data:`, vendorData);
        console.error(`Profile data:`, profileData);
        // This should rarely happen - but if it does, we'll show a message
        vendorName = "Your Business";
      }
      
      const vendorLocation = vendorData?.location || profileData?.location || null;
      const vendorCategory = profileData?.category || vendorData?.category || null;
      const vendorIsPremium = profileData?.is_premium || vendorData?.is_premium || false;
      const vendorSubscriptionPlan = profileData?.subscription_plan || vendorData?.subscription_plan || "free_trial";

      // Attach vendor information to each menu item
      const itemsWithVendor = (menuData || []).map(item => ({
        ...item,
        vendors: {
          id: vendorData?.id || profileData?.id || null,
          name: vendorName,
          image_url: vendorData?.image_url || null,
          location: vendorLocation,
          category: vendorCategory,
          is_premium: vendorIsPremium,
          subscription_plan: vendorSubscriptionPlan
        }
      }));

      console.log(`✅ Fetched ${itemsWithVendor.length} menu items with vendor info:`, {
        vendorName,
        vendorLocation,
        vendorCategory
      });

      setMenuItems(itemsWithVendor);
    } catch (error) {
      console.error("Error fetching menu items:", error);
    } finally {
      setLoading(false);
    }
  };

  const getMenuLimit = () => {
    switch (subscriptionPlan) {
      case "professional":
        return Infinity; // Unlimited
      case "starter":
        return 10;
      case "free_trial":
      default:
        return 5; // Free trial: 5 items
    }
  };

  const canAddMoreItems = () => {
    const limit = getMenuLimit();
    if (limit === Infinity) return true;
    return menuItems.length < limit;
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      title: "",
      description: "",
      price: "",
      availability: true,
    });
    setImageFile(null);
    setImagePreview(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      description: item.description || "",
      price: item.price.toString(),
      availability: item.availability,
    });
    setImageFile(null);
    setImagePreview(item.image_url);
    setIsModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        alert("Please select a valid image file.");
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert("Image size must be less than 5MB.");
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

  const uploadImage = async (file: File, userId: string): Promise<string | null> => {
    try {
      setUploading(true);
      
      // Ensure user is authenticated - use getUser() for more reliable auth check
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error("getUser error:", userError);
        throw new Error(`Authentication error: ${userError.message}`);
      }
      if (!user) {
        console.error("No user found");
        throw new Error("User not authenticated. Please log in again.");
      }

      // Verify session is still valid and contains access token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error("Session error:", sessionError);
        throw new Error(`Session error: ${sessionError.message}`);
      }
      if (!session) {
        console.error("No session found");
        throw new Error("No active session found. Please log in again.");
      }
      if (!session.access_token) {
        console.error("Session missing access token");
        throw new Error("Session is invalid. Please log in again.");
      }

      console.log("User authenticated:", user.id, "Session valid:", !!session.access_token);
      
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase Storage (menu-images bucket)
      const { error: uploadError } = await supabase.storage
        .from("menu-images")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        
        // Provide specific error messages
        if (uploadError.message?.includes("not found") || uploadError.message?.includes("Bucket")) {
          throw new Error("Storage bucket 'menu-images' not found. Please create it in Supabase Storage settings and configure RLS policies.");
        }
        if (uploadError.message?.includes("new row violates row-level security") || uploadError.message?.includes("RLS")) {
          throw new Error("Storage upload denied by security policy. Please check that authenticated users have upload permissions on the 'menu-images' bucket.");
        }
        if (uploadError.message?.includes("JWT")) {
          throw new Error("Authentication token is invalid or expired. Please log in again.");
        }
        
        throw new Error(`Upload failed: ${uploadError.message || "Unknown error"}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("menu-images")
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error: any) {
      console.error("Error uploading image:", error);
      // Error message is already set in the catch block above
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const deleteImage = async (imageUrl: string) => {
    try {
      // Extract file path from Supabase Storage URL
      // URL format: https://[project].supabase.co/storage/v1/object/public/menu-images/[userId]/[filename]
      const urlParts = imageUrl.split("/");
      const menuImagesIndex = urlParts.findIndex(part => part === "menu-images");
      
      if (menuImagesIndex !== -1 && menuImagesIndex < urlParts.length - 1) {
        // Get the path after "menu-images"
        const pathAfterBucket = urlParts.slice(menuImagesIndex + 1).join("/");
        
        if (pathAfterBucket) {
          const { error } = await supabase.storage
            .from("menu-images")
            .remove([pathAfterBucket]);
          
          if (error) {
            console.error("Error deleting image from storage:", error);
            // Don't throw - image deletion is not critical for the main operation
          }
        }
      } else {
        console.warn("Could not extract file path from URL:", imageUrl);
      }
    } catch (error) {
      console.error("Error deleting image:", error);
      // Don't throw - image deletion is not critical
    }
  };

  const handleSave = async () => {
    // Validation
    if (!formData.title.trim()) {
      alert("Please enter a product title.");
      return;
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      alert("Please enter a valid price.");
      return;
    }

    setSaving(true);

    try {
      // Verify user authentication
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error("getUser error:", userError);
        alert(`Authentication error: ${userError.message}. Please log in again.`);
        setSaving(false);
        return;
      }
      if (!user) {
        alert("Please log in again.");
        setSaving(false);
        return;
      }

      // Verify session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session || !session.access_token) {
        console.error("Session error:", sessionError);
        alert("Session is invalid. Please log in again.");
        setSaving(false);
        return;
      }

      let imageUrl = editingItem?.image_url || null;

      // Upload new image if selected
      if (imageFile) {
        try {
          // Delete old image if editing
          if (editingItem?.image_url) {
            await deleteImage(editingItem.image_url);
          }

          imageUrl = await uploadImage(imageFile, user.id);
          if (!imageUrl) {
            alert("Failed to upload image. Please try again.");
            setSaving(false);
            return;
          }
        } catch (uploadError: any) {
          // uploadImage already throws with a descriptive error message
          alert(uploadError.message || "Failed to upload image. Please try again.");
          setSaving(false);
          return;
        }
      }

      if (editingItem) {
        // Update existing item
        const { error } = await supabase
          .from("menu_items")
          .update({
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            price: parseFloat(formData.price),
            image_url: imageUrl,
            availability: formData.availability,
          })
          .eq("id", editingItem.id);

        if (error) {
          console.error("Error updating item:", error);
          
          // Provide specific error messages
          if (error.message?.includes("new row violates row-level security") || error.message?.includes("RLS")) {
            alert("Update denied by security policy. Please check that you have permission to update this menu item.");
          } else if (error.message?.includes("JWT") || error.message?.includes("token")) {
            alert("Authentication error. Please log in again.");
          } else {
            alert(`Failed to update item: ${error.message || "Unknown error"}`);
          }
        } else {
          setIsModalOpen(false);
          await fetchMenuItems();
        }
      } else {
        // Check subscription limit before creating new item
        if (!canAddMoreItems()) {
          const limit = getMenuLimit();
          alert(
            `You have reached your menu item limit (${limit} items).\n\n` +
            `Your current plan: ${subscriptionPlan === "free_trial" ? "Free Trial" : subscriptionPlan === "starter" ? "Starter Plan" : "Professional Plan"}\n\n` +
            `Upgrade to Professional Plan for unlimited menu items.`
          );
          setSaving(false);
          return;
        }

        // Create new item
        const { error } = await supabase
          .from("menu_items")
          .insert([
            {
              title: formData.title.trim(),
              description: formData.description.trim() || null,
              price: parseFloat(formData.price),
              image_url: imageUrl,
              availability: formData.availability,
              vendor_id: user.id,
            },
          ]);

        if (error) {
          console.error("Error creating item:", error);
          console.error("Error details:", JSON.stringify(error, null, 2));
          
          // Provide specific error messages
          if (error.message?.includes("new row violates row-level security") || error.message?.includes("RLS")) {
            alert("Create denied by security policy. Please check that:\n1. The menu_items table RLS policies allow authenticated users to insert\n2. The vendor_id matches your user ID\n3. You have the necessary permissions.");
          } else if (error.message?.includes("JWT") || error.message?.includes("token")) {
            alert("Authentication error. Please log in again.");
          } else if (error.message?.includes("null value") || error.message?.includes("violates not-null constraint")) {
            alert(`Missing required field: ${error.message}. Please check that all required fields are filled.`);
          } else if (error.message?.includes("foreign key") || error.message?.includes("constraint")) {
            alert(`Data validation error: ${error.message}. Please check that all field values are valid.`);
          } else {
            alert(`Failed to create item: ${error.message || "Unknown error"}`);
          }
        } else {
          setIsModalOpen(false);
          await fetchMenuItems();
        }
      }
    } catch (error: any) {
      console.error("Error saving item:", error);
      // If error is already handled above, don't show generic message
      if (!error.message || error.message.includes("upload")) {
        alert(error.message || "An error occurred. Please try again.");
      }
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const handleDeleteClick = (item: MenuItem) => {
    setItemToDelete(item);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;

    try {
      // Delete image if exists
      if (itemToDelete.image_url) {
        await deleteImage(itemToDelete.image_url);
      }

      // Delete menu item
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", itemToDelete.id);

      if (error) {
        console.error("Error deleting item:", error);
        alert("Failed to delete item. Please try again.");
      } else {
        setIsDeleteDialogOpen(false);
        setItemToDelete(null);
        await fetchMenuItems();
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("An error occurred. Please try again.");
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    try {
      const newAvailability = !item.availability;
      
      const { error } = await supabase
        .from("menu_items")
        .update({ availability: newAvailability })
        .eq("id", item.id);

      if (error) {
        console.error("Error updating availability:", error);
        alert("Failed to update availability. Please try again.");
      } else {
        await fetchMenuItems();
      }
    } catch (error) {
      console.error("Error updating availability:", error);
      alert("An error occurred. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-hospineil-base-bg">
        <Loader2 className="animate-spin text-hospineil-primary h-8 w-8 mb-4" />
        <p className="text-gray-600 font-body">Loading menu...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-hospineil-primary mb-2 font-header">Menu Management</h1>
            <p className="text-gray-600 font-body">Manage your menu items and product listings</p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600 font-body">
                Plan: <span className="font-semibold capitalize text-hospineil-primary">{subscriptionPlan === "free_trial" ? "Free Trial" : subscriptionPlan === "starter" ? "Starter Plan" : "Professional Plan"}</span>
              </span>
              {subscriptionPlan !== "professional" && (
                <span className="text-sm text-gray-600 font-body">
                  • {menuItems.length}/{getMenuLimit()} items
                </span>
              )}
            </div>
          </div>
          <Button
            onClick={openAddModal}
            disabled={!canAddMoreItems()}
            className="bg-hospineil-primary text-white rounded-lg hover:bg-hospineil-primary/90 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-button"
            size="lg"
          >
            <Plus className="mr-2 h-5 w-5" />
            Add Menu Item
            {!canAddMoreItems() && " (Limit Reached)"}
          </Button>
        </div>
      </div>

      {/* Menu Items Grid */}
      {menuItems.length === 0 ? (
        <div className="bg-hospineil-light-bg rounded-2xl shadow-md p-12 text-center">
          <ImageIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2 font-header">No items yet</h3>
          <p className="text-gray-600 mb-6 font-body">Add your first product to get started!</p>
          <Button
            onClick={openAddModal}
            className="bg-hospineil-primary text-white rounded-lg hover:bg-hospineil-primary/90 hover:scale-105 transition-all font-button"
          >
            <Plus className="mr-2 h-5 w-5" />
            Add Your First Product
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {menuItems.map((item) => (
            <div
              key={item.id}
              className="bg-hospineil-light-bg rounded-2xl shadow-md hover:shadow-lg hover:scale-105 transition-all border border-gray-200 overflow-hidden flex flex-col"
            >
              {/* Image */}
              <div className="relative w-full h-48 bg-gray-100">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-gray-400" />
                  </div>
                )}
                {/* Availability Badge */}
                <div className="absolute top-3 right-3">
                  <button
                    onClick={() => toggleAvailability(item)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold shadow-md transition-colors ${
                      item.availability
                        ? "bg-green-500 text-white hover:bg-green-600"
                        : "bg-red-500 text-white hover:bg-red-600"
                    }`}
                  >
                    {item.availability ? "Available" : "Out of Stock"}
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 flex flex-col flex-grow">
                {/* Vendor Information */}
                {item.vendors && (
                  <div className="mb-3 pb-3 -mx-4 px-4 bg-hospineil-accent rounded-t-2xl">
                    <div className="flex items-center gap-2">
                      {item.vendors.image_url ? (
                        <img
                          src={item.vendors.image_url}
                          alt={item.vendors.name}
                          className="w-6 h-6 rounded-full object-cover border-2 border-white/30"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center">
                          <span className="text-xs text-white font-semibold">
                            {item.vendors.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate font-header">
                          {item.vendors.name}
                          {item.vendors.category && (
                            <span className="text-white/80 font-normal"> • {item.vendors.category.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</span>
                          )}
                        </p>
                        {item.vendors.location && (
                          <p className="text-xs text-white/90 truncate font-body">
                            📍 {item.vendors.location}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2 font-header">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2 flex-grow font-body">
                  {item.description || "No description"}
                </p>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-bold text-hospineil-primary font-header">
                    ₦{item.price.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(item)}
                    className="flex-1 bg-hospineil-primary text-white hover:bg-hospineil-primary/90 hover:scale-105 transition-all font-button"
                  >
                    <Edit2 className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteClick(item)}
                    className="flex-1 border-2 border-hospineil-accent text-hospineil-accent hover:bg-hospineil-accent hover:text-white hover:scale-105 transition-all font-button"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex justify-between items-start">
              <div>
                <DialogTitle>
                  {editingItem ? "Edit Menu Item" : "Add Menu Item"}
                </DialogTitle>
                <DialogDescription>
                  {editingItem
                    ? "Update the details of your menu item"
                    : "Add a new item to your menu"}
                </DialogDescription>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 -mt-1 -mr-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Image Upload */}
            <div>
              <Label htmlFor="image">Product Image</Label>
              <div className="mt-2">
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-32 w-32 object-cover rounded-lg border-2 border-gray-300"
                    />
                    <button
                      onClick={() => {
                        setImagePreview(null);
                        setImageFile(null);
                      }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="image-upload"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <Upload className="h-8 w-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-600">Click to upload image</span>
                    <span className="text-xs text-gray-500">PNG, JPG up to 5MB</span>
                  </label>
                )}
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                  disabled={uploading}
                />
              </div>
              {uploading && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="animate-spin h-4 w-4" />
                    Uploading image...
                  </div>
                </div>
              )}
            </div>

            {/* Product Title */}
            <div>
              <Label htmlFor="title">
                Product Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Jollof Rice"
                className="mt-1"
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your product..."
                rows={3}
                className="mt-1"
              />
            </div>

            {/* Price and Availability */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price">
                  Price (₦) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="availability" className="flex items-center gap-2 cursor-pointer">
                  <input
                    id="availability"
                    type="checkbox"
                    checked={formData.availability}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        availability: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2"
                  />
                  <span>Available</span>
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={saving || uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || uploading}
              className="bg-hospineil-primary text-white hover:bg-hospineil-primary/90 hover:scale-105 transition-all font-button"
            >
              {saving || uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {uploading ? "Uploading..." : "Saving..."}
                </>
              ) : editingItem ? (
                "Update Item"
              ) : (
                "Add Item"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the menu item
              {itemToDelete && ` "${itemToDelete.title}"`} and remove it from your menu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-hospineil-accent text-white hover:bg-hospineil-accent/90 hover:scale-105 transition-all font-button"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
