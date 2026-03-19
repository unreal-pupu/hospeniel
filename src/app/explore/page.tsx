"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
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
import VerifiedBadge from "@/components/VerifiedBadge";
import type { RealtimePostgresChangesPayload, REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import ServiceRequestDialog from "@/components/ServiceRequestDialog";
import { debounce } from "@/lib/clientThrottle";
import SEOHead from "@/components/SEOHead";
import { generateBreadcrumbSchema } from "@/lib/seo";
import { getLocationsWithAll } from "@/lib/vendorLocations";
import { getCategoriesWithAll, getCategoryLabel } from "@/lib/vendorCategories";

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
    description?: string | null;
    verified?: boolean;
    vendor_table_id?: string | null;
    is_premium?: boolean;
    subscription_plan?: string;
  };
}

interface VendorCardData {
  profile_id: string;
  name: string;
  image_url: string | null;
  location?: string | null;
  category?: string | null;
  description?: string | null;
  verified?: boolean;
  vendor_table_id?: string | null;
  is_premium?: boolean;
  subscription_plan?: string;
}

interface ProfileRow {
  id: string;
  name: string | null;
  location: string | null;
  role: string | null;
  category: string | null;
  is_premium?: boolean | null;
  subscription_plan?: string | null;
  verified?: boolean | null;
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
  verified?: boolean | null;
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
  verified?: boolean;
}

const LOCATIONS = getLocationsWithAll();
const CATEGORIES = getCategoriesWithAll();

export default function ExplorePage() {
  const router = useRouter();
  const pathname = usePathname();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [filteredMenuItems, setFilteredMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("All Locations");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [serviceProfileVendors, setServiceProfileVendors] = useState<ServiceProfileVendor[]>([]);
  const [loadingServiceProfiles, setLoadingServiceProfiles] = useState(false);
  const [vendorRatings, setVendorRatings] = useState<Record<string, { average: number; count: number }>>({});
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
          verified: v.verified ?? false,
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
        bio: v.bio,
        verified: v.verified ?? false,
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
        .select("id, name, business_name, image_url, location, profile_id, description, category, is_premium, subscription_plan, verified")
        .in("profile_id", vendorIds);

      // Fetch profiles - CRITICAL: Don't filter by role initially to catch all profiles
      // Some profiles might not have role set correctly, but we still need their names
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, name, location, role, category, is_premium, subscription_plan, verified")
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
          .select("id, name, location, role, category, is_premium, subscription_plan, verified")
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
          const vendorVerified = profile?.verified ?? vendor?.verified ?? false;
          
          
          // Always create vendors object, even if data is incomplete
          // This ensures vendor info is always available for display
          const vendorInfo = {
            id: vendor?.id || profile?.id || null,
            // Use the resolved vendor name
            name: finalVendorName,
            image_url: vendor?.image_url || null,
            location: vendorLocation || null,
            category: vendorCategory || null,
            description: vendor?.description || null,
            verified: vendorVerified,
            vendor_table_id: vendor?.id ? String(vendor.id) : null,
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

  const filteredVendors = useMemo(() => {
    const vendorMap = new Map<string, VendorCardData>();
    filteredMenuItems.forEach((item) => {
      if (!item.vendor_id) return;
      if (vendorMap.has(item.vendor_id)) return;

      vendorMap.set(item.vendor_id, {
        profile_id: item.vendor_id,
        name: item.vendors?.name || "Vendor",
        image_url: item.vendors?.image_url || null,
        location: item.vendors?.location || null,
        category: item.vendors?.category || null,
        description: item.vendors?.description || null,
        verified: item.vendors?.verified || false,
        vendor_table_id: item.vendors?.vendor_table_id || null,
        is_premium: item.vendors?.is_premium,
        subscription_plan: item.vendors?.subscription_plan,
      });
    });
    return Array.from(vendorMap.values());
  }, [filteredMenuItems]);

  const [priorityBoostVendorIds, setPriorityBoostVendorIds] = useState<string[]>([]);

  const vendorIdSignature = useMemo(() => {
    // Small signature to avoid refetching too often
    return filteredVendors.map((v) => v.profile_id).sort().join("|");
  }, [filteredVendors]);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      const vendorIds = Array.from(new Set(filteredVendors.map((v) => v.profile_id))).filter(Boolean);
      if (vendorIds.length === 0) {
        if (isMounted) setPriorityBoostVendorIds([]);
        return;
      }

      // Avoid overly large payloads
      const slice = vendorIds.slice(0, 200);
      try {
        const res = await fetch("/api/vendor-entitlements/active-feature", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vendorIds: slice, featureName: "priority_location_boost" }),
        });
        const data = await res.json();
        if (!isMounted) return;
        const activeIds = (data?.activeVendorIds || []) as string[];
        console.log("Priority Location Boost:", {
          selectedLocation,
          selectedCategory,
          totalVendorsInPage: vendorIds.length,
          eligibleInSlice: slice.length,
          activeVendorIdsCount: activeIds.length,
        });
        setPriorityBoostVendorIds(activeIds);
      } catch (e) {
        console.error("Priority location boost fetch error:", e);
        if (isMounted) setPriorityBoostVendorIds([]);
      }
    };

    void run();
    return () => {
      isMounted = false;
    };
  }, [vendorIdSignature]);

  const displayedVendors = useMemo(() => {
    const prioritySet = new Set(priorityBoostVendorIds);
    const requireLocationMatch = selectedLocation !== "All Locations";
    const selectedLocationNormalized = selectedLocation.trim().toLowerCase();

    const indexed = filteredVendors.map((v, idx) => ({ v, idx }));
    indexed.sort((a, b) => {
      const aLoc = (a.v.location || "").trim().toLowerCase();
      const bLoc = (b.v.location || "").trim().toLowerCase();
      const aPriority =
        prioritySet.has(String(a.v.profile_id)) &&
        (!requireLocationMatch || aLoc === selectedLocationNormalized);
      const bPriority =
        prioritySet.has(String(b.v.profile_id)) &&
        (!requireLocationMatch || bLoc === selectedLocationNormalized);

      if (aPriority !== bPriority) return Number(bPriority) - Number(aPriority);
      return a.idx - b.idx;
    });

    return indexed.map((x) => x.v);
  }, [filteredVendors, priorityBoostVendorIds, selectedLocation]);

  useEffect(() => {
    const fetchRatings = async () => {
      const vendorIds = filteredVendors
        .map((vendor) => vendor.vendor_table_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0);

      if (vendorIds.length === 0) {
        setVendorRatings({});
        return;
      }

      const { data, error } = await supabase
        .from("vendor_ratings")
        .select("vendor_id, rating")
        .in("vendor_id", vendorIds);

      if (error) {
        console.error("Error fetching vendor ratings:", error);
        setVendorRatings({});
        return;
      }

      const ratingBuckets = new Map<string, { total: number; count: number }>();
      (data || []).forEach((row: { vendor_id: string | number; rating: number }) => {
        const key = String(row.vendor_id);
        const entry = ratingBuckets.get(key) || { total: 0, count: 0 };
        entry.total += row.rating || 0;
        entry.count += 1;
        ratingBuckets.set(key, entry);
      });

      const ratingsMap: Record<string, { average: number; count: number }> = {};
      ratingBuckets.forEach((value, key) => {
        ratingsMap[key] = {
          average: value.count > 0 ? value.total / value.count : 0,
          count: value.count,
        };
      });

      setVendorRatings(ratingsMap);
    };

    fetchRatings();
  }, [filteredVendors]);

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
                selectedCategory !== "All" ? getCategoryLabel(selectedCategory) + " Vendors" : "Vendors"
              }${selectedLocation !== "All Locations" ? ` in ${selectedLocation}` : ""} | Hospineil`
            : undefined
        }
        description={
          selectedLocation !== "All Locations" || selectedCategory !== "All"
            ? `Discover ${selectedCategory !== "All" ? getCategoryLabel(selectedCategory).toLowerCase() + " vendors" : "local vendors"}${selectedLocation !== "All Locations" ? ` in ${selectedLocation}` : ""}. Browse vendors, view profiles, and explore their menus.`
            : undefined
        }
      />

      <div className="min-h-screen bg-hospineil-base-bg flex">
        {/* ✅ Left Sidebar */}
        <aside
        className={`
          fixed lg:static top-32 bottom-0 left-0 z-40
          w-64 bg-hospineil-primary shadow-xl
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-6 border-b border-hospineil-primary/20 flex items-start justify-between">
            <h2 className="text-xl font-bold text-white font-logo">Hospeniel</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg text-white/90 hover:text-white hover:bg-white/10"
              aria-label="Close menu"
              type="button"
            >
              <X size={20} />
            </button>
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
          className="fixed inset-x-0 bottom-0 top-32 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ✅ Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-32 z-30">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                aria-label={sidebarOpen ? "Close menu" : "Open menu"}
                type="button"
              >
                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
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
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pt-6 sm:pt-8 lg:pt-10 overflow-y-auto">
          {/* ✅ Service Profile Vendors Section (Chefs & Home Cooks) */}
          {(() => {
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
              <div className="mb-8 pt-2 sm:pt-4">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 font-header relative z-10">
                  Chef and Home Cooks Too
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
                      className="relative bg-white rounded-2xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:z-10 border border-gray-100"
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
                        <h3 className="text-lg font-bold text-gray-800 font-header flex items-center gap-2">
                          <span>{vendor.name}</span>
                          <VerifiedBadge verified={vendor.verified} />
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

          {/* ✅ Vendor Directory Section */}
              <div className="mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-3xl font-bold text-hospineil-primary mb-2 font-header">
                  Explore Vendors
                    </h2>
                    <p className="text-gray-600 font-body">
                  Browse vendor profiles and explore their menus
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

          {filteredVendors.length === 0 && !loading ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                  <p className="text-gray-500 text-lg mb-4">
                    {selectedLocation === "All Locations" && selectedCategory === "All"
                  ? "No vendors available yet."
                  : `No vendors found${selectedLocation !== "All Locations" ? ` in ${selectedLocation}` : ""}${selectedCategory !== "All" ? ` for ${selectedCategory}` : ""}.`}
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
              {displayedVendors.map((vendor) => (
                <Link
                  key={vendor.profile_id}
                  href={`/vendors/profile/${vendor.profile_id}`}
                      className="bg-white rounded-2xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.01] border border-gray-100 hover:border-hospineil-accent/30 group flex flex-col"
                    >
                  <div className="relative w-full h-48 sm:h-52 overflow-hidden bg-gray-100">
                    {vendor.image_url ? (
                          <Image
                        src={vendor.image_url}
                        alt={vendor.name}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                          target.src = "/default-vendor.png";
                            }}
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                            <UtensilsCrossed className="h-12 w-12 text-gray-400" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-black/0 to-black/0" />
                      </div>

                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-800 line-clamp-1 font-header flex items-center gap-1">
                        <span>{vendor.name}</span>
                          <VerifiedBadge verified={vendor.verified} />
                      </h3>
                      {vendor.category && (
                        <span className="px-2 py-1 bg-hospineil-accent/10 text-hospineil-accent text-xs font-semibold rounded-full whitespace-nowrap">
                          {getCategoryLabel(vendor.category)}
                        </span>
                          )}
                        </div>
                    {vendor.vendor_table_id &&
                      vendorRatings[String(vendor.vendor_table_id)] && (
                      <p className="text-sm text-gray-600 mb-2 font-body">
                        ⭐ {vendorRatings[String(vendor.vendor_table_id)].average.toFixed(1)} ({vendorRatings[String(vendor.vendor_table_id)].count} reviews)
                      </p>
                    )}
                    {vendor.location && (
                      <p className="text-sm text-gray-600 mb-2 font-body flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        <span>{vendor.location}</span>
                      </p>
                    )}
                    <p className="text-sm text-gray-600 line-clamp-2 font-body">
                      {vendor.description || "View menu and vendor details"}
                    </p>
                    <div className="mt-4 text-sm font-semibold text-hospineil-primary">
                      View Profile →
                              </div>
                            </div>
                </Link>
                  ))}
                </div>
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
