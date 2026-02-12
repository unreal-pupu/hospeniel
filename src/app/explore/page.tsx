"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { supabase } from "../../lib/supabaseClient";
import { useCart } from "../context/CartContex";
import {
  LayoutDashboard,
  ShoppingCart,
  UtensilsCrossed,
  MapPin,
  Settings,
  LogOut,
  Menu,
  X,
  ShoppingBag,
  HelpCircle,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";
import type { RealtimePostgresChangesPayload, REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import ServiceRequestDialog from "@/components/ServiceRequestDialog";
import { throttle, debounce, ThrottleDelays } from "@/lib/clientThrottle";
import SEOHead from "@/components/SEOHead";
import { generateBreadcrumbSchema } from "@/lib/seo";
import { getLocationsWithAll } from "@/lib/vendorLocations";
import { getCategoriesWithAll, getCategoryLabel } from "@/lib/vendorCategories";

interface Vendor {
  id: string;
  name?: string;
  business_name?: string;
  description: string;
  image_url: string;
  location?: string;
  profile_id?: string;
  category?: string;
}

interface MenuItem {
  id: string;
  vendor_id: string;
  title: string;
  description: string;
  price: number;
  image_url: string;
  availability: boolean | string;
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

interface MenuItemRow {
  vendor_id: string | null;
}

interface ProfileRow {
  id: string;
  name: string | null;
  location: string | null;
  role: string | null;
  category: string | null;
  is_premium?: boolean | null;
  subscription_plan?: string | null;
}

interface VendorRow {
  id?: string | null;
  name?: string | null;
  business_name?: string | null;
  image_url?: string | null;
  location?: string | null;
  profile_id?: string | null;
  description?: string | null;
  category?: string | null;
  is_premium?: boolean | null;
  subscription_plan?: string | null;
}
interface UserProfile {
  name: string;
  avatar_url: string;
}

interface ServiceProfileVendor {
  id: string;
  profile_id: string;
  name: string;
  image_url: string | null;
  location: string | null;
  category: 'chef' | 'home_cook';
  specialties: string[];
  pricing_model: 'per_meal' | 'per_hour' | 'per_job';
  base_price: number;
  service_mode: string[];
  bio: string | null;
}

const LOCATIONS = getLocationsWithAll();
const CATEGORIES = getCategoriesWithAll();

export default function ExplorePage() {
  const router = useRouter();
  const pathname = usePathname();
  const { addToCart } = useCart();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [filteredMenuItems, setFilteredMenuItems] = useState<MenuItem[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("All Locations");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [serviceProfileVendors, setServiceProfileVendors] = useState<ServiceProfileVendor[]>([]);
  const [loadingServiceProfiles, setLoadingServiceProfiles] = useState(false);
  const [serviceRequestDialog, setServiceRequestDialog] = useState<{
    open: boolean;
    vendorId: string;
    vendorName: string;
    isPremium: boolean;
    subscriptionPlan?: string;
  } | null>(null);

  // Fetch chefs and home cooks with service profiles
  // Use API route (like Featured Vendors) to bypass RLS and ensure consistency
  const fetchServiceProfileVendors = useCallback(async () => {
    try {
      setLoadingServiceProfiles(true);
      console.log('🔍 Fetching service profile vendors (chefs/home cooks) via API...');
      
      // Use API route (same pattern as Featured Vendors) to bypass RLS issues
      const response = await fetch('/api/service-profile-vendors', {
        cache: 'no-store', // Always fetch fresh data
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ API Error:', response.status, errorData);
        setServiceProfileVendors([]);
        return;
      }
      
      const apiPayload = await response.json() as {
        vendors?: ServiceProfileVendor[];
        error?: string;
      };
      const data = apiPayload.vendors || [];
      const apiError = apiPayload.error;
      
      if (apiError) {
        console.error('❌ API returned error:', apiError);
        setServiceProfileVendors([]);
        return;
      }
      
      if (!data || data.length === 0) {
        console.log('ℹ️ API returned no vendors');
        setServiceProfileVendors([]);
        return;
      }
      
      console.log(`✅ API returned ${data.length} service profile vendors:`, 
        data.map((v) => ({ 
          id: v.id, 
          name: v.name, 
          category: v.category, 
          specialtiesCount: v.specialties?.length || 0,
          hasImage: !!v.image_url
        }))
      );
      
      // Transform API response to match ServiceProfileVendor interface
      const transformed: ServiceProfileVendor[] = data.map((v) => ({
        id: v.id,
        profile_id: v.profile_id,
        name: v.name,
        image_url: v.image_url,
        location: v.location,
        category: v.category,
        specialties: v.specialties || [],
        pricing_model: v.pricing_model,
        base_price: v.base_price || 0,
        service_mode: v.service_mode || [],
        bio: v.bio
      }));
      
      setServiceProfileVendors(transformed);
    } catch (error) {
      console.error('❌ Error fetching service profile vendors:', error);
      setServiceProfileVendors([]);
    } finally {
      setLoadingServiceProfiles(false);
    }
  }, []);

  // Memoize fetchAllMenuItems to prevent recreation and ensure stable reference
  const fetchAllMenuItems = useCallback(async () => {
    try {
      setLoading(true);
      console.log("Fetching menu items with vendor information...");

      // Fetch ALL menu items (we'll filter by availability in the UI)
      // This ensures we don't miss any items due to schema inconsistencies
      const { data: menuData, error: menuError } = await supabase
        .from("menu_items")
        .select("*")
        .order("created_at", { ascending: false });

      if (menuError) {
        console.error("Error fetching menu items:", menuError);
        setMenuItems([]);
        setFilteredMenuItems([]);
        setLoading(false);
        return;
      }

      if (!menuData || menuData.length === 0) {
        console.log("No menu items found");
        setMenuItems([]);
        setFilteredMenuItems([]);
        setLoading(false);
        return;
      }

      console.log(`Found ${menuData.length} menu items`);

      // Get unique vendor IDs (these are auth.users.id values)
      const menuItems: MenuItem[] = menuData ?? [];
      const vendorIds = [
        ...new Set(menuItems.map((item) => item.vendor_id).filter((id): id is string => Boolean(id))),
      ];
      console.log(`Found ${vendorIds.length} unique vendor IDs:`, vendorIds);

      if (vendorIds.length === 0) {
        console.warn("No vendor IDs found in menu items");
        setMenuItems([]);
        setFilteredMenuItems([]);
        setLoading(false);
        return;
      }

      // Fetch vendors where profile_id matches vendor_id from menu_items
      // vendor_id in menu_items = auth.users.id = vendors.profile_id
      // Also fetch profiles to get location if vendors.location is not available
      const { data: vendorsData, error: vendorsError } = await supabase
        .from("vendors")
        .select("id, name, business_name, image_url, location, profile_id, description, category, is_premium, subscription_plan")
        .in("profile_id", vendorIds);

      // Fetch profiles - CRITICAL: Don't filter by role initially to catch all profiles
      // Some profiles might not have role set correctly, but we still need their names
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, location, role, category, is_premium, subscription_plan")
        .in("id", vendorIds);
      
      // Filter to vendors in memory (but we fetched all to catch missing roles)
      const profileRows: ProfileRow[] = profilesData ?? [];
      const vendorProfiles = profileRows.filter(
        (p: ProfileRow): p is ProfileRow => p.role === "vendor"
      );
      console.log(`Found ${profilesData?.length || 0} total profiles, ${vendorProfiles.length} with role='vendor'`);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
      }

      if (vendorsError) {
        console.error("Error fetching vendors:", vendorsError);
        // Continue even if vendor fetch fails - we'll show items without vendor info
      }

      console.log(`Found ${vendorsData?.length || 0} vendors:`, vendorsData);
      console.log(`Found ${profilesData?.length || 0} profiles:`, profilesData);

      // Create a map of profile_id (auth.users.id) to vendor data
      const vendorMap = new Map<string, VendorRow>();
      const vendorRows: VendorRow[] = vendorsData ?? [];
      if (vendorRows.length > 0) {
        vendorRows.forEach((vendor: VendorRow) => {
          if (vendor.profile_id) {
            vendorMap.set(vendor.profile_id, vendor);
            console.log(`Mapped vendor: profile_id=${vendor.profile_id}, business_name=${vendor.business_name || 'none'}, name=${vendor.name || 'none'}, location=${vendor.location || 'none'}`);
          }
        });
      }

      // Create a map of profile_id to profile data (PRIMARY SOURCE for vendor names)
      // Use ALL profiles (not just vendors) to catch any missing role assignments
      const profileMap = new Map<string, ProfileRow>();
      if (profileRows.length > 0) {
        profileRows.forEach((profile: ProfileRow) => {
          if (profile.id) {
            profileMap.set(profile.id, profile);
            const roleInfo = profile.role === "vendor" ? "vendor" : `role=${profile.role || 'null'}`;
            console.log(`Mapped profile: id=${profile.id}, name="${profile.name || 'MISSING'}", ${roleInfo}, location=${profile.location || 'none'}, category=${profile.category || 'none'}`);
          }
        });
      }
      
      // Log any vendor IDs that don't have profiles and try to fetch them
      const missingProfileIds = vendorIds.filter(id => !profileMap.has(id));
      if (missingProfileIds.length > 0) {
        console.warn(`⚠️ ${missingProfileIds.length} vendor IDs have no profiles in initial fetch:`, missingProfileIds);
        console.warn(`Attempting to fetch missing profiles directly (without role filter)...`);
        
        // Try to fetch missing profiles directly (without role filter)
        const { data: missingProfilesData, error: missingError } = await supabase
          .from("profiles")
          .select("id, name, location, role, category, is_premium, subscription_plan")
          .in("id", missingProfileIds);
        
        const missingProfiles: ProfileRow[] = missingProfilesData ?? [];
        if (missingProfiles.length > 0) {
          console.log(`✅ Found ${missingProfilesData.length} missing profiles via direct fetch`);
          missingProfiles.forEach((profile: ProfileRow) => {
            if (profile.id) {
              profileMap.set(profile.id, profile);
              const roleInfo = profile.role === "vendor" ? "vendor" : `role=${profile.role || 'null'}`;
              console.log(`✅ Added missing profile: id=${profile.id}, name="${profile.name || 'MISSING'}", ${roleInfo}`);
            }
          });
        } else if (missingError) {
          console.error(`❌ Error fetching missing profiles:`, missingError);
        } else {
          console.error(`❌ CRITICAL: ${missingProfileIds.length} vendor IDs truly have no profiles in database`);
          console.error(`This indicates a data integrity issue - menu_items.vendor_id should match profiles.id`);
          console.error(`Missing IDs:`, missingProfileIds);
        }
      }

      // Combine menu items with vendor information
      // Filter out items that are not available (handle both boolean and text)
      const itemsWithVendors = menuItems
        .filter((item: MenuItem) => {
          // Only show available items
          // Handle both boolean (true/false) and text ('available'/'out_of_stock') formats
          const isAvailable = item.availability === true || 
                              item.availability === "available" ||
                              item.availability === "Available";
          return isAvailable;
        })
        .map((item: MenuItem) => {
          const vendor = vendorMap.get(item.vendor_id);
          const profile = profileMap.get(item.vendor_id); // Get profile for location fallback
          
          // Debug logging
          if (!vendor && !profile) {
            console.warn(`⚠️ No vendor or profile data found for menu item ${item.id} with vendor_id ${item.vendor_id}`);
            console.warn(`Available vendor IDs in map:`, Array.from(vendorMap.keys()));
            console.warn(`Available profile IDs in map:`, Array.from(profileMap.keys()));
          }
          
          // Priority order for vendor name:
          // 1. name from profiles table (PRIMARY SOURCE - where vendor names are stored)
          // 2. business_name from vendors table (fallback)
          // 3. name from vendors table (fallback)
          // 4. Only use fallback message if absolutely nothing is found
          let finalVendorName: string | null = null;
          
          // CRITICAL: profiles.name is the PRIMARY and ONLY source for vendor names
          // menu_items.vendor_id = profiles.id (this is the join)
          if (profile) {
            // ALWAYS use profile.name if profile exists (even if name is null, we'll handle it)
            if (profile.name && typeof profile.name === 'string' && profile.name.trim() !== "") {
              finalVendorName = profile.name.trim();
              console.log(`✅ Menu item ${item.id}: Using profile.name="${finalVendorName}" from profiles table`);
            } else {
              // Profile exists but name is missing - log warning
              console.warn(`⚠️ Menu item ${item.id}: Profile exists (id=${profile.id}) but profile.name is missing or empty`);
              console.warn(`Profile data:`, profile);
              
              // Try fallback to vendor table
              if (vendor?.business_name && typeof vendor.business_name === 'string' && vendor.business_name.trim() !== "") {
                finalVendorName = vendor.business_name.trim();
                console.log(`⚠️ Using vendor.business_name (fallback): "${finalVendorName}"`);
              } else if (vendor?.name && typeof vendor.name === 'string' && vendor.name.trim() !== "") {
                finalVendorName = vendor.name.trim();
                console.log(`⚠️ Using vendor.name (fallback): "${finalVendorName}"`);
              }
            }
          } else {
            // No profile found in map - this should be rare after batch fetch above
            console.error(`❌ CRITICAL: No profile found for vendor_id ${item.vendor_id} (menu item ${item.id})`);
            console.error(`This means menu_items.vendor_id=${item.vendor_id} doesn't match any profiles.id`);
            console.error(`Available profile IDs in map:`, Array.from(profileMap.keys()));
            console.error(`This indicates a data integrity issue - the profile may not exist in the database`);
            
            // Try vendor table as last resort
            if (vendor?.business_name && typeof vendor.business_name === 'string' && vendor.business_name.trim() !== "") {
              finalVendorName = vendor.business_name.trim();
              console.log(`⚠️ Using vendor.business_name (last resort): "${finalVendorName}"`);
            } else if (vendor?.name && typeof vendor.name === 'string' && vendor.name.trim() !== "") {
              finalVendorName = vendor.name.trim();
              console.log(`⚠️ Using vendor.name (last resort): "${finalVendorName}"`);
            }
          }
          
          // Final check - if we still don't have a name, show error message
          if (!finalVendorName || finalVendorName === "") {
            console.error(`❌ CRITICAL: No vendor name found for menu item ${item.id}, vendor_id: ${item.vendor_id}`);
            console.error(`Vendor data:`, vendor);
            console.error(`Profile data:`, profile);
            console.error(`Profile name value:`, profile?.name);
            console.error(`Profile name type:`, typeof profile?.name);
            finalVendorName = "Vendor Name Not Available";
          }
          
          // Use vendor location first, then fall back to profile location
          const vendorLocation = vendor?.location || profile?.location || null;
          // Use category from profiles table (primary source), fallback to vendors table
          const vendorCategory = profile?.category || vendor?.category || null;
          // Use is_premium from profiles table (primary source), fallback to vendors table
          const vendorIsPremium = profile?.is_premium || vendor?.is_premium || false;
          const vendorSubscriptionPlan = profile?.subscription_plan || vendor?.subscription_plan || "free_trial";
          
          
          // Always create vendors object, even if data is incomplete
          // This ensures vendor info is always available for display
          const vendorInfo = {
            id: vendor?.id || profile?.id || null,
            // Use the resolved vendor name
            name: finalVendorName,
            image_url: vendor?.image_url || null,
            location: vendorLocation || null,
            category: vendorCategory || null,
            is_premium: vendorIsPremium || false,
            subscription_plan: vendorSubscriptionPlan || "free_trial"
          };
          
          console.log(`✅ Menu item ${item.id}: Vendor info - name: "${vendorInfo.name}", category: ${vendorInfo.category || 'none'}, location: ${vendorInfo.location || 'none'}`);
          
          return {
            ...item,
            vendors: vendorInfo
          };
        });

      console.log(`Processed ${itemsWithVendors.length} menu items with vendor data`);
      setMenuItems(itemsWithVendors);
      // Initialize filtered menu items - will be filtered by location in useEffect
      setFilteredMenuItems(itemsWithVendors);
    } catch (error) {
      console.error("Error fetching menu items:", error);
      setMenuItems([]);
      setFilteredMenuItems([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty deps - setMenuItems, setFilteredMenuItems, setLoading are stable

  // Initialize data on mount
  useEffect(() => {
    fetchUserProfile();
    fetchAllMenuItems(); // Show menu items by default
    fetchServiceProfileVendors(); // Fetch chefs/home cooks with service profiles

    // Listen for auth state changes to update greeting
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      fetchUserProfile();
    });

    // Listen for service profile updates from CookChefDashboard
    const handleServiceProfileUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('Service profile updated event received:', customEvent.detail);
      // Immediately refetch without debounce for user-initiated updates
      // Add a small delay to ensure database has updated
      setTimeout(() => {
        console.log('Refetching service profile vendors after update...');
        fetchServiceProfileVendors();
      }, 500);
    };
    
    window.addEventListener('vendor-service-profile-updated', handleServiceProfileUpdate);

    // Debounced handler for menu items updates - use memoized fetchAllMenuItems
    const debouncedFetchMenuItems = debounce(() => {
      if (typeof fetchAllMenuItems === 'function') {
        fetchAllMenuItems();
      }
    }, 1000); // 1 second debounce for real-time updates

    // Debounced handler for service profile updates
    // Set up real-time subscription for menu items
    const menuItemsChannel = supabase
      .channel("menu_items_changes")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "menu_items",
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          console.log("Menu items changed:", payload.eventType, payload);
          // Use debounced handler to prevent too many refetches
          if (typeof debouncedFetchMenuItems === 'function') {
            debouncedFetchMenuItems();
          }
        }
      )
      .subscribe((status: REALTIME_SUBSCRIBE_STATES) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ Successfully subscribed to menu_items changes");
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ Error subscribing to menu_items changes");
        }
      });

    // Set up real-time subscription for service profiles
    const serviceProfilesChannel = supabase
      .channel("vendor_service_profiles_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vendor_service_profiles",
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          console.log("Service profile changed:", payload.eventType, payload);
          // Immediately refetch for updates (no debounce for real-time)
          fetchServiceProfileVendors();
        }
      )
      .subscribe((status: REALTIME_SUBSCRIBE_STATES) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ Successfully subscribed to vendor_service_profiles changes");
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ Error subscribing to vendor_service_profiles changes");
        }
      });
    
    // Also subscribe to profiles table changes (in case category or role changes)
    const profilesChannel = supabase
      .channel("profiles_changes_for_service_vendors")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: "category=in.(chef,home_cook)",
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          console.log("Profile category/role changed for chef/home_cook:", payload);
          // Refetch service profile vendors when profile updates
          fetchServiceProfileVendors();
        }
      )
      .subscribe((status: REALTIME_SUBSCRIBE_STATES) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ Successfully subscribed to profiles changes for service vendors");
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ Error subscribing to profiles changes");
        }
      });

    return () => {
      subscription.unsubscribe();
      menuItemsChannel.unsubscribe();
      serviceProfilesChannel.unsubscribe();
      profilesChannel.unsubscribe();
      window.removeEventListener('vendor-service-profile-updated', handleServiceProfileUpdate);
    };
  }, [fetchAllMenuItems, fetchServiceProfileVendors]);

  const fetchUserProfile = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.log("User not authenticated");
        return;
      }

      // Fetch user's name from profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      // Fetch user's avatar from user_settings table
      const { data: settings, error: settingsError } = await supabase
        .from("user_settings")
        .select("avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (settingsError) {
        console.warn("User settings not available (continuing without avatar):", settingsError);
      }

      if (profile) {
        setUserProfile({
          name: profile.name || user.email?.split("@")[0] || "User",
          avatar_url: settings?.avatar_url || "/default-avatar.png",
        });
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };


  // Filter menu items by vendor location and category
  useEffect(() => {
    console.log(`📍 Filtering menu items by location: "${selectedLocation}" and category: "${selectedCategory}"`);
    console.log(`   Total menu items: ${menuItems.length}`);
    
    let filtered = menuItems;

    // Filter by location
    if (selectedLocation !== "All Locations") {
      const selectedLocNormalized = selectedLocation.trim().toLowerCase();
      filtered = filtered.filter((item) => {
        if (!item.vendors?.location) return false;
        const vendorLocationNormalized = (item.vendors.location || "").trim().toLowerCase();
        return vendorLocationNormalized === selectedLocNormalized;
      });
    }

    // Filter by category (use category from profiles table)
    if (selectedCategory !== "All") {
      filtered = filtered.filter((item) => {
        if (!item.vendors?.category) return false;
        const vendorCategory = (item.vendors.category || "").trim();
        return vendorCategory === selectedCategory;
      });
    }
    
    console.log(`✅ Filtered to ${filtered.length} menu items`);
    setFilteredMenuItems(filtered);
  }, [selectedLocation, selectedCategory, menuItems]);

  // Throttled add to cart handler
  const handleAddToCart = useMemo(
    () => throttle(async (...args: unknown[]) => {
      const [itemId, vendorId] = args;
      if (typeof itemId !== "string" || typeof vendorId !== "string") {
        console.error("Invalid arguments for addToCart");
        return;
      }
      try {
        setAddingToCart(itemId);
        if (!vendorId) {
          alert("Invalid vendor information. Please try again.");
          return;
        }
        await addToCart(itemId, vendorId, 1);
        // Show toast notification
        const toast = document.createElement("div");
        toast.className = "fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in slide-in-from-right";
        toast.textContent = "✓ Item added to cart!";
        document.body.appendChild(toast);
        setTimeout(() => {
          if (document.body.contains(toast)) {
            document.body.removeChild(toast);
          }
        }, 3000);
      } catch (error) {
        console.error("Error adding to cart:", error);
        const errorMessage = error instanceof Error ? error.message : "";
        if (errorMessage.includes("log in")) {
          alert("Please log in to add items to cart.");
          router.push("/loginpage");
        } else {
          const errMsg = error instanceof Error ? error.message : "Failed to add item to cart. Please try again.";
          alert(errMsg);
        }
      } finally {
        setAddingToCart(null);
      }
    }, ThrottleDelays.ADD_TO_CART),
    [addToCart, router]
  );


  // Memoize placeOrder to prevent recreation on every render
  const placeOrder = useMemo(
    () => throttle(async (...args: unknown[]) => {
      const [menuItemArg] = args;
      
      // Validate menuItem argument
      if (!menuItemArg || typeof menuItemArg !== "object") {
        console.error("Invalid menuItem argument for placeOrder");
        return;
      }
      
      const menuItem = menuItemArg as MenuItem;
      
      try {
        setPlacingOrder(true);
        
        // Verify user is authenticated
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError) {
          console.error("Authentication error:", userError);
          alert("Authentication error. Please log in again.");
          setPlacingOrder(false);
          return;
        }

        if (!user) {
          alert("Please login to place an order");
          router.push("/loginpage");
          setPlacingOrder(false);
          return;
        }

        // Verify session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          alert("Session expired. Please log in again.");
          router.push("/loginpage");
          setPlacingOrder(false);
          return;
        }

        // Verify user.id is a valid UUID
        if (!user.id || typeof user.id !== 'string' || !user.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          console.error("Invalid user.id:", user.id);
          alert("Invalid user account. Please log out and log in again.");
          setPlacingOrder(false);
          return;
        }

        // Validate required fields
        if (!menuItem.vendor_id) {
          alert("Invalid vendor information. Please try again.");
          setPlacingOrder(false);
          return;
        }

        // Verify vendor_id is a valid UUID
        if (!menuItem.vendor_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          console.error("Invalid vendor_id:", menuItem.vendor_id);
          alert("Invalid vendor information. Please try again.");
          setPlacingOrder(false);
          return;
        }

        if (!menuItem.id) {
          alert("Invalid product information. Please try again.");
          setPlacingOrder(false);
          return;
        }

        // Verify product_id is a valid UUID
        if (!menuItem.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          console.error("Invalid product_id:", menuItem.id);
          alert("Invalid product information. Please try again.");
          setPlacingOrder(false);
          return;
        }

        if (!menuItem.price || menuItem.price <= 0) {
          alert("Invalid product price. Please try again.");
          setPlacingOrder(false);
          return;
        }

        // Prepare order data for checkout (don't create order yet - wait for payment)
        const orderData = {
          user_id: user.id,
          vendor_id: menuItem.vendor_id,
          product_id: menuItem.id,
          quantity: 1,
          total_price: menuItem.price,
          status: "Pending",
        };

        // Store order data in sessionStorage for checkout page
        if (typeof window !== "undefined") {
          sessionStorage.setItem("directOrderData", JSON.stringify([orderData]));
          sessionStorage.setItem("directOrderSource", "explore");
        }

        // Redirect to payment/checkout page
        router.push("/payment");
      } catch (error) {
        console.error("Unexpected error placing order:", error);
        const errorMessage = error instanceof Error ? error.message : "Please try again";
        alert(`An unexpected error occurred: ${errorMessage}`);
      } finally {
        setPlacingOrder(false);
      }
    }, ThrottleDelays.BUTTON_CLICK),
    [router]
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-600">
        Loading...
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("Error logging out:", error.message);
        alert("Failed to log out. Try again.");
        return;
      }

      // Clear localStorage session data
      localStorage.removeItem('hospineil-auth');
      
      // Clear Supabase auth storage (it might use different keys)
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('auth') || key.includes('sb-'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      console.log("✅ Logged out successfully");
      alert("Logged out successfully!");
      
      // Redirect to login page with force parameter to ensure login form is shown
      window.location.href = "/loginpage?logout=true";
    } catch (err) {
      console.error("Logout error:", err);
      alert("An error occurred during logout. Please try again.");
    }
  };

  const navigationItems = [
    { href: "/explore", label: "Explore", icon: LayoutDashboard, active: true },
    { href: "/explore/service-responses", label: "Service Responses", icon: MessageSquare },
    { href: "/orders", label: "Orders", icon: ShoppingBag },
    { href: "/cart", label: "Cart", icon: ShoppingCart },
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/help-center", label: "Help Center", icon: HelpCircle },
    { href: "/privacy-policy", label: "Privacy Policy", icon: ShieldCheck },
  ];


  // Generate breadcrumb schema for explore page
  const breadcrumbData = generateBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Explore", url: "/explore" },
  ]);

  return (
    <>
      {/* SEO Head Component for Dynamic Metadata */}
      <SEOHead
        structuredData={breadcrumbData}
        title={
          selectedLocation !== "All Locations" || selectedCategory !== "All"
            ? `${
                selectedCategory !== "All" ? getCategoryLabel(selectedCategory) + "s" : "Menu Items"
              }${selectedLocation !== "All Locations" ? ` in ${selectedLocation}` : ""} | Hospineil`
            : undefined
        }
        description={
          selectedLocation !== "All Locations" || selectedCategory !== "All"
            ? `Discover ${selectedCategory !== "All" ? getCategoryLabel(selectedCategory).toLowerCase() + "s" : "delicious meals"}${selectedLocation !== "All Locations" ? ` in ${selectedLocation}` : ""}. Browse menus, place orders, and enjoy delicious local food.`
            : undefined
        }
      />

      <div className="min-h-screen bg-hospineil-base-bg flex">
        {/* ✅ Left Sidebar */}
        <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-hospineil-primary shadow-xl
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-6 border-b border-hospineil-primary/20">
            <h2 className="text-xl font-bold text-white font-logo">Hospineil</h2>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/explore" && pathname?.startsWith(item.href));
              return (
                <button
                  key={item.href}
                  onClick={() => {
                    router.push(item.href);
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-colors duration-200
                    ${
                      item.active || isActive
                        ? "bg-white/20 text-white font-semibold"
                        : "text-white/90 hover:bg-hospineil-accent hover:text-white"
                    }
                  `}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Logout Button */}
          <div className="p-4 border-t border-hospineil-primary/20">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white/90 hover:bg-red-500/20 hover:text-white transition-colors duration-200"
            >
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ✅ Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ✅ Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
              >
                {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
              </button>

              {/* Greeting Section */}
              {userProfile && (
                <div className="flex items-center gap-4 ml-auto">
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <h1 className="text-lg font-semibold text-gray-800">
                        Hello <span className="inline-block">👋</span>{" "}
                        <span className="text-hospineil-primary">{userProfile.name}</span>
                      </h1>
                    </div>
                    <div className="relative">
                      <Image
                        src={userProfile.avatar_url || "/default-avatar.png"}
                        alt={`${userProfile.name}'s Avatar`}
                        width={48}
                        height={48}
                        className="rounded-full border-2 border-hospineil-primary/20 shadow-md object-cover"
                        priority
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {/* ✅ Service Profile Vendors Section (Chefs & Home Cooks) */}
          {!selectedVendor && (() => {
            // Show loading state
            if (loadingServiceProfiles) {
              return (
                <div className="mb-8 p-4 bg-hospineil-light-bg rounded-lg">
                  <p className="text-gray-600 text-center font-body">
                    Loading chefs and home cooks...
                  </p>
                </div>
              );
            }
            
            // If no vendors, log debug info
            if (serviceProfileVendors.length === 0) {
              console.log('⚠️ Service Profile Vendors Section: No vendors to display', {
                loadingServiceProfiles,
                serviceProfileVendorsCount: serviceProfileVendors.length,
                timestamp: new Date().toISOString()
              });
              return null;
            }
            
            console.log('✅ Rendering Service Profile Vendors Section with', serviceProfileVendors.length, 'vendors');
            
            // Filter service profile vendors by location and category
            const filteredServiceVendors = serviceProfileVendors.filter((vendor) => {
              // Filter by location if selected
              if (selectedLocation !== "All Locations" && vendor.location !== selectedLocation) {
                return false;
              }
              
              // Filter by category if selected
              if (selectedCategory !== "All") {
                const categoryMatch = selectedCategory === "chef" && vendor.category === "chef" ||
                                     selectedCategory === "home_cook" && vendor.category === "home_cook";
                if (!categoryMatch) {
                  return false;
                }
              }
              
              return true;
            });
            
            // Debug logging
            console.log('Service Profile Vendors Section:', {
              total: serviceProfileVendors.length,
              filtered: filteredServiceVendors.length,
              selectedLocation,
              selectedCategory,
              vendors: serviceProfileVendors.map(v => ({ id: v.id, name: v.name, category: v.category }))
            });
            
            if (filteredServiceVendors.length === 0) {
              // Show message if filtered out, but only if we have vendors that were filtered
              if (serviceProfileVendors.length > 0) {
                return (
                  <div className="mb-8 p-4 bg-hospineil-light-bg rounded-lg">
                    <p className="text-gray-600 text-center font-body">
                      No chefs or home cooks match your current filters. Try adjusting location or category filters.
                    </p>
                  </div>
                );
              }
              return null;
            }
            
            return (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 font-header">
                  Chefs & Home Cooks
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredServiceVendors.map((vendor) => {
                    const priceLabel = vendor.pricing_model === 'per_meal' ? 'per meal' :
                                     vendor.pricing_model === 'per_hour' ? 'per hour' :
                                     'per job';
                    const hasPricing = vendor.base_price > 0;
                    
                    return (
                    <div
                      key={vendor.id}
                      className="bg-white rounded-2xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-105 border border-gray-100"
                    >
                      {/* Vendor Image */}
                      <div className="relative w-full h-48 overflow-hidden bg-gray-200">
                        {vendor.image_url ? (
                          <Image
                            src={vendor.image_url}
                            alt={vendor.name}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = "/default-vendor.png";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                            <UtensilsCrossed className="h-12 w-12 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Vendor Info */}
                      <div className="p-5 pt-4 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-bold text-gray-800 font-header">
                            {vendor.name}
                          </h3>
                          <span className="px-2 py-1 bg-hospineil-primary/10 text-hospineil-primary text-xs font-semibold rounded-full">
                            {getCategoryLabel(vendor.category)}
                          </span>
                        </div>
                        
                        {vendor.location && (
                          <p className="text-sm text-gray-600 mb-2 font-body flex items-center gap-1">
                            <MapPin className="h-4 w-4 text-gray-500" />
                            <span>{vendor.location}</span>
                          </p>
                        )}

                        {vendor.specialties.length > 0 && (
                          <p className="text-sm text-gray-500 mb-2 font-body">
                            {vendor.specialties.join(", ")}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between mb-3">
                          {hasPricing ? (
                            <>
                              <span className="text-lg font-bold text-hospineil-primary font-header">
                                ₦{vendor.base_price.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                              </span>
                              <span className="text-xs text-gray-500 font-body">{priceLabel}</span>
                            </>
                          ) : (
                            <span className="text-sm font-semibold text-gray-600 font-body">
                              Contact for pricing
                            </span>
                          )}
                        </div>
                        
                        <button
                          onClick={() => {
                            setServiceRequestDialog({
                              open: true,
                              vendorId: vendor.profile_id,
                              vendorName: vendor.name,
                              isPremium: true, // Set to true so dialog works (chefs/home cooks always accept requests)
                              subscriptionPlan: 'professional', // Not used for chefs/home cooks but required by dialog
                            });
                          }}
                          className="w-full bg-hospineil-primary text-white py-2 rounded-lg hover:bg-hospineil-primary/90 transition-colors font-button flex items-center justify-center gap-2"
                        >
                          <MessageSquare className="h-4 w-4" />
                          Request Service
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ✅ Menu Items Section */}
          {!selectedVendor ? (
            <>
              <div className="mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-3xl font-bold text-hospineil-primary mb-2 font-header">
                      Explore Menu Items
                    </h2>
                    <p className="text-gray-600 font-body">
                      Discover delicious meals from all vendors
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Location Filter */}
                    <div className="flex items-center gap-3 bg-hospineil-primary/10 px-4 py-2 rounded-lg border border-hospineil-primary/20">
                      <label htmlFor="location-filter" className="text-sm font-semibold text-hospineil-primary whitespace-nowrap flex items-center gap-2">
                        <span>📍</span>
                        <span>Location:</span>
                      </label>
                      <select
                        id="location-filter"
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className="px-4 py-2 border border-hospineil-primary/30 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-hospineil-primary focus:border-hospineil-primary min-w-[180px] font-medium font-body"
                      >
                        {LOCATIONS.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Category Filter */}
                    <div className="flex items-center gap-3 bg-hospineil-accent/10 px-4 py-2 rounded-lg border border-hospineil-accent/20">
                      <label htmlFor="category-filter" className="text-sm font-semibold text-hospineil-accent whitespace-nowrap flex items-center gap-2">
                        <span>🏷️</span>
                        <span>Category:</span>
                      </label>
                      <select
                        id="category-filter"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="px-4 py-2 border border-hospineil-accent/30 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-hospineil-accent focus:border-hospineil-accent min-w-[180px] font-medium font-body"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {filteredMenuItems.length === 0 && !loading ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                  <p className="text-gray-500 text-lg mb-4">
                    {selectedLocation === "All Locations" && selectedCategory === "All"
                      ? "No menu items available yet."
                      : `No menu items found${selectedLocation !== "All Locations" ? ` in ${selectedLocation}` : ""}${selectedCategory !== "All" ? ` for ${selectedCategory}` : ""}.`}
                  </p>
                  {(selectedLocation !== "All Locations" || selectedCategory !== "All") && (
                    <div className="flex gap-2 justify-center">
                      {selectedLocation !== "All Locations" && (
                        <button
                          onClick={() => setSelectedLocation("All Locations")}
                          className="text-hospineil-primary hover:text-hospineil-accent font-medium font-button"
                        >
                          Show All Locations
                        </button>
                      )}
                      {selectedCategory !== "All" && (
                        <button
                          onClick={() => setSelectedCategory("All")}
                          className="text-hospineil-accent hover:text-hospineil-primary font-medium font-button"
                        >
                          Show All Categories
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredMenuItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.01] border border-gray-100 hover:border-hospineil-accent/30 group flex flex-col"
                    >
                      {/* Product Image */}
                      <div className="relative w-full h-64 sm:h-60 overflow-hidden bg-gray-100">
                        {item.image_url ? (
                          <Image
                            src={item.image_url}
                            alt={item.title}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = "/placeholder-image.png";
                            }}
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                            <UtensilsCrossed className="h-12 w-12 text-gray-400" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-black/0 to-black/0" />
                        {/* Availability Badge */}
                        <div className="absolute top-3 right-3">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold shadow-md ${
                              (item.availability === true || (typeof item.availability === "string" && item.availability.toLowerCase() === "available"))
                                ? "bg-green-500 text-white"
                                : "bg-red-500 text-white"
                            }`}
                          >
                            {(item.availability === true || (typeof item.availability === "string" && item.availability.toLowerCase() === "available")) ? "Available" : "Out of Stock"}
                          </span>
                        </div>
                      </div>

                      {/* Product Info */}
                      <div className="p-5">
                        {/* Vendor Name - Prominent Display - Always show if vendor data exists */}
                        {item.vendors ? (
                          <div className="mb-3 pb-3 border-b border-gray-100">
                            <div className="flex items-center gap-2 mb-1">
                              {item.vendors.image_url ? (
                                <div className="relative w-8 h-8 rounded-full overflow-hidden border border-gray-200">
                                  <Image
                                    src={item.vendors.image_url}
                                    alt={item.vendors.name || "Vendor"}
                                    fill
                                    className="object-cover"
                                    sizes="32px"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = "/default-vendor.png";
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
                                  <UtensilsCrossed className="w-4 h-4 text-gray-400" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate font-header">
                                  {/* CRITICAL: Display vendor name from profiles.name - never show placeholder if name exists */}
                                  {item.vendors.name && 
                                   item.vendors.name !== "Vendor Name Not Available"
                                    ? item.vendors.name 
                                    : "Vendor"}
                                  {item.vendors.category && (
                                    <span className="text-gray-500 font-normal"> – {getCategoryLabel(item.vendors.category)}</span>
                                  )}
                                </p>
                                {item.vendors.location && (
                                  <p className="text-xs text-gray-500 flex items-center gap-1 font-body">
                                    <span>📍</span>
                                    <span>{item.vendors.location}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mb-3 pb-3 border-b border-gray-200">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
                                <UtensilsCrossed className="w-4 h-4 text-gray-400" />
                              </div>
                              <p className="text-xs text-gray-500 italic font-body">Loading vendor information...</p>
                            </div>
                          </div>
                        )}

                        {/* Product Title */}
                        <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2 font-header">
                          {item.title}
                        </h3>

                        {/* Description */}
                        <p className="text-gray-600 text-sm mb-2 line-clamp-2 font-body">
                          {item.description || "No description available"}
                        </p>

                        {/* Price and Buttons */}
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-hospineil-primary font-bold text-xl font-header">
                            ₦{item.price.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                          </p>
                        </div>

                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAddToCart(item.id, item.vendor_id)}
                              disabled={!(item.availability === true || item.availability === "available") || addingToCart === item.id}
                              className={`flex-1 py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium font-button ${
                                (item.availability === true || item.availability === "available")
                                  ? "bg-hospineil-primary text-white hover:bg-hospineil-primary/90 hover:scale-105"
                                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
                              }`}
                            >
                              {addingToCart === item.id ? "Adding..." : (item.availability === true || item.availability === "available") ? "Add to Cart" : "Out of Stock"}
                            </button>
                            <button
                              onClick={() => placeOrder(item)}
                              disabled={placingOrder || !(item.availability === true || item.availability === "available")}
                              className={`flex-1 py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium border-2 font-button ${
                                (item.availability === true || item.availability === "available")
                                  ? "border-hospineil-accent text-hospineil-accent hover:bg-hospineil-accent hover:text-white hover:scale-105"
                                  : "border-gray-300 text-gray-500 cursor-not-allowed"
                              }`}
                            >
                              {placingOrder ? "Placing..." : (item.availability === true || item.availability === "available") ? "Order Now" : "Out of Stock"}
                            </button>
                          </div>
                          
                          {/* Contact Vendor Button - Only for Premium Vendors (is_premium = true) */}
                          {item.vendors && item.vendor_id && item.vendors.is_premium === true && (
                            <button
                              onClick={() => {
                                setServiceRequestDialog({
                                  open: true,
                                  vendorId: item.vendor_id,
                                  vendorName: item.vendors?.name || "Vendor",
                                  isPremium: true,
                                  subscriptionPlan: item.vendors?.subscription_plan || "professional",
                                });
                              }}
                              className="w-full py-2 rounded-lg transition-all font-medium border-2 border-hospineil-primary text-hospineil-primary hover:bg-hospineil-primary hover:text-white flex items-center justify-center gap-2 font-button"
                            >
                              <MessageSquare className="h-4 w-4" />
                              Request Service
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setSelectedVendor(null);
                  fetchAllMenuItems();
                }}
                className="flex items-center gap-2 text-hospineil-primary hover:text-hospineil-accent font-medium mb-6 transition-colors font-button"
              >
                <X size={20} className="rotate-45" />
                Back to All Items
              </button>

              <div className="mb-6">
                <h2 className="text-3xl font-bold text-hospineil-primary mb-2 font-header">
                  {selectedVendor.name} Menu
                </h2>
                <p className="text-gray-600 font-body">
                  Browse our delicious menu items
                </p>
              </div>

              {menuItems.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                  <p className="text-gray-500 text-lg">
                    No menu items yet.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {menuItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.01] border border-gray-100 hover:border-hospineil-accent/30 group flex flex-col"
                    >
                      <div className="relative w-full h-64 sm:h-60 overflow-hidden bg-gray-100">
                        <Image
                          src={item.image_url || "/placeholder-image.png"}
                          alt={item.title}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-black/0 to-black/0" />
                        <div className="absolute top-3 right-3">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold shadow-md ${
                              (item.availability === true || item.availability === "available")
                                ? "bg-green-500 text-white"
                                : "bg-red-500 text-white"
                            }`}
                          >
                            {(item.availability === true || item.availability === "available") ? "Available" : "Out of Stock"}
                          </span>
                        </div>
                      </div>
                      <div className="p-5 pt-4 flex flex-col h-full">
                        {/* Vendor Name - Prominent Display (for selected vendor view) - Always show if vendor data exists */}
                        {item.vendors ? (
                          <div className="mb-3 pb-3 border-b border-gray-100">
                            <div className="flex items-center gap-2 mb-1">
                              {item.vendors.image_url ? (
                                <div className="relative w-8 h-8 rounded-full overflow-hidden border border-gray-200">
                                  <Image
                                    src={item.vendors.image_url}
                                    alt={item.vendors.name || "Vendor"}
                                    fill
                                    className="object-cover"
                                    sizes="32px"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = "/default-vendor.png";
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
                                  <UtensilsCrossed className="w-4 h-4 text-gray-400" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate font-header">
                                  {item.vendors.name || "Vendor"}
                                  {item.vendors.category && (
                                    <span className="text-gray-500 font-normal"> – {getCategoryLabel(item.vendors.category)}</span>
                                  )}
                                </p>
                                {item.vendors.location && (
                                  <p className="text-xs text-gray-500 flex items-center gap-1 font-body">
                                    <span>📍</span>
                                    <span>{item.vendors.location}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mb-3 pb-3 border-b border-gray-200">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
                                <UtensilsCrossed className="w-4 h-4 text-gray-400" />
                              </div>
                              <p className="text-xs text-gray-500 italic font-body">Loading vendor information...</p>
                            </div>
                          </div>
                        )}

                        <h3 className="text-lg font-semibold text-gray-800 mb-2 font-header">
                          {item.title}
                        </h3>
                        <p className="text-gray-600 text-sm mb-2 line-clamp-2 font-body">
                          {item.description}
                        </p>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-hospineil-primary font-bold text-xl font-header">
                            ₦{item.price.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAddToCart(item.id, item.vendor_id)}
                              disabled={!(item.availability === true || item.availability === "available") || addingToCart === item.id}
                              className={`flex-1 py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium font-button ${
                                (item.availability === true || item.availability === "available")
                                  ? "bg-hospineil-primary text-white hover:bg-hospineil-primary/90 hover:scale-105"
                                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
                              }`}
                            >
                              {addingToCart === item.id ? "Adding..." : (item.availability === true || item.availability === "available") ? "Add to Cart" : "Out of Stock"}
                            </button>
                            <button
                              onClick={() => placeOrder(item)}
                              disabled={placingOrder || !(item.availability === true || item.availability === "available")}
                              className={`flex-1 py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium border-2 font-button ${
                                (item.availability === true || item.availability === "available")
                                  ? "border-hospineil-accent text-hospineil-accent hover:bg-hospineil-accent hover:text-white hover:scale-105"
                                  : "border-gray-300 text-gray-500 cursor-not-allowed"
                              }`}
                            >
                              {placingOrder ? "Placing..." : (item.availability === true || item.availability === "available") ? "Order Now" : "Out of Stock"}
                            </button>
                          </div>
                          {/* Contact Vendor Button - Only for Premium Vendors (is_premium = true) */}
                          {item.vendors && item.vendor_id && item.vendors.is_premium === true && (
                            <button
                              onClick={() => {
                                setServiceRequestDialog({
                                  open: true,
                                  vendorId: item.vendor_id,
                                  vendorName: item.vendors?.name || "Vendor",
                                  isPremium: true,
                                  subscriptionPlan: item.vendors?.subscription_plan || "professional",
                                });
                              }}
                              className="w-full py-2 rounded-lg transition-all font-medium border-2 border-hospineil-primary text-hospineil-primary hover:bg-hospineil-primary hover:text-white flex items-center justify-center gap-2 font-button"
                            >
                              <MessageSquare className="h-4 w-4" />
                              Request Service
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Service Request Dialog */}
      {serviceRequestDialog && (
        <ServiceRequestDialog
          open={serviceRequestDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              setServiceRequestDialog(null);
            } else {
              setServiceRequestDialog({ ...serviceRequestDialog, open });
            }
          }}
          vendorId={serviceRequestDialog.vendorId}
          vendorName={serviceRequestDialog.vendorName}
          isPremium={serviceRequestDialog.isPremium}
          subscriptionPlan={serviceRequestDialog.subscriptionPlan}
          isChefOrHomeCook={serviceProfileVendors.some(v => v.profile_id === serviceRequestDialog.vendorId)}
        />
      )}
    </div>
    </>
  );
}
