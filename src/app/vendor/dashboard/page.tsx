"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getSessionUserAfterNavigation } from "@/lib/auth-timeouts";
import { RefreshCw, Loader2, Info } from "lucide-react";
import type {
  User,
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  REALTIME_SUBSCRIBE_STATES,
} from "@supabase/supabase-js";
import { getRoleBasedRedirect } from "@/lib/roleRouting";
import dynamic from "next/dynamic";
import { VendorPremiumToolsSection } from "@/components/vendor-premium-tools-section";
import {
  PLATFORM_COMMISSION_PERCENT_LABEL,
  PLATFORM_FOOD_COMMISSION_RATE,
} from "@/lib/platformPricing";

const CookChefDashboard = dynamic(() => import('@/components/CookChefDashboard'), {
  loading: () => (
    <div className="w-full min-h-screen bg-hospineil-base-bg flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-hospineil-primary" />
    </div>
  ),
});

interface VendorProfile {
  id: string;
  name: string | null; // Allow null to track if name was found
  email: string;
  role: string;
  subscription_plan?: string;
  is_premium?: boolean;
  category?: string | null;
}

interface MenuItem {
  id: string;
  title: string;
  price: number;
  availability: string;
}

interface Order {
  id: string;
  total_price: number;
  food_subtotal?: number;
  status: string;
  created_at: string;
}

interface WindowWithVendorDashboard extends Window {
  __vendorDashboardFetchOrders?: (showRefreshing?: boolean) => Promise<void>;
}

// Commission calculation helper (matches platform food commission rate)
const COMMISSION_RATE = PLATFORM_FOOD_COMMISSION_RATE;

const calculateCommission = (amount: number): number => {
  return amount * COMMISSION_RATE;
};

const calculateNetEarnings = (amount: number): number => {
  return amount - calculateCommission(amount);
};

function isValidUuid(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

const VendorDashboard: React.FC = () => {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [menuItemsError, setMenuItemsError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const vendorIdRef = useRef<string | null>(null);

  // Safety timeout: Force loading to false after 5 seconds to prevent infinite loading
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      if (loading && !vendor) {
        console.warn("⚠️ Vendor Dashboard: Safety timeout - forcing loading to false");
        setLoading(false);
        // Set a fallback vendor so dashboard can render
        setVendor({
          id: "timeout-fallback",
          name: null,
          email: "",
          role: "vendor",
        });
      }
    }, 5000);

    return () => clearTimeout(safetyTimeout);
  }, [loading, vendor]);

  // ✅ Single auth check and data load (optimized to prevent multiple redirects)
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const loadDashboard = async () => {
      let currentUser: User | null = null;
      try {
        console.log("🔵 Vendor Dashboard: Starting to load...");

        // Add timeout protection - if loading takes more than 10 seconds, show error
        timeoutId = setTimeout(() => {
          if (isMounted) {
            console.error("❌ Vendor Dashboard: Loading timeout after 10 seconds");
            // Set fallback vendor so dashboard can render
            setVendor({
              id: "timeout",
              name: null,
              email: "",
              role: "vendor",
            });
            setLoading(false);
            alert("Dashboard loading is taking too long. Please refresh the page.");
          }
        }, 10000);

        if (!isMounted) return;

        // Step 1: Check authentication — after full-page redirect from login, mobile can
        // briefly return null from getUser(); poll until session is hydrated.
        console.log("🔵 Vendor Dashboard: Checking authentication...");
        const user = await getSessionUserAfterNavigation(supabase);
        currentUser = user;

        console.log("🔵 Vendor Dashboard: Auth check result:", {
          hasUser: !!user,
          userId: user?.id,
        });

        if (!user) {
          console.error("❌ Vendor Dashboard: No authenticated user after session wait");
          clearTimeout(timeoutId);
          if (isMounted) {
            router.replace("/loginpage");
          }
          return;
        }

        if (!isMounted) {
          clearTimeout(timeoutId);
          return;
        }

        // Step 2: Get vendor profile
        // CRITICAL: Explicitly select name field to ensure it's fetched
        console.log("🔵 Vendor Dashboard: Fetching vendor profile...");
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, name, email, role, address, location, category, subscription_plan, is_premium, created_at")
          .eq("id", user.id)
          .limit(1)
          .maybeSingle();

        // Better error logging
        if (profileError) {
          const errorDetails = {
            message: profileError.message || "Unknown error",
            code: profileError.code || "NO_CODE",
            details: profileError.details || null,
            hint: profileError.hint || null,
            status: (profileError as { status?: number }).status || null,
          };
          console.error("❌ Vendor Dashboard: Profile fetch error:", errorDetails);
          
          // Set error message for display
          if (isMounted) {
            setProfileError(
              profileError.message || 
              profileError.code || 
              "Failed to load vendor profile. Please try refreshing the page."
            );
          }
          
          // DON'T redirect - allow vendor to stay on dashboard even if profile fetch fails
          // The profile might exist but RLS might be blocking it, or there might be a temporary issue
          // Set fallback vendor so dashboard can render
          if (isMounted) {
            setVendor({
              id: user.id,
              name: null, // No name available due to error
              email: user.email || "",
              role: "vendor",
            });
            setLoading(false);
            console.log("✅ Vendor Dashboard: Fallback vendor set due to error - staying on dashboard");
          }
          // Continue to try fetching menu items and orders even if profile fetch failed
        }

        console.log("🔵 Vendor Dashboard: Profile fetch result:", {
          hasError: !!profileError,
          error: profileError ? (profileError.message || profileError.code || "Unknown error") : null,
          hasProfile: !!profile,
          role: profile?.role,
          profileId: profile?.id,
          profileName: profile?.name,
          category: profile?.category,
        });

        // If profile doesn't exist, still allow vendor to stay on dashboard
        // They might have menu items or orders even without a complete profile
        if (!profile && !profileError) {
          console.warn("⚠️ Vendor Dashboard: No profile found, but no error - might be RLS issue");
          // Set fallback vendor but DON'T redirect
          if (isMounted) {
            setVendor({
              id: user.id,
              name: null,
              email: user.email || "",
              role: "vendor",
            });
            setLoading(false);
            console.log("✅ Vendor Dashboard: Fallback vendor set - staying on dashboard");
          }
          // Continue to fetch menu items and orders
        }

        if (!isMounted) {
          clearTimeout(timeoutId);
          return;
        }

        // Step 3: ✅ CRITICAL - Check role from profiles.role FIRST
        // Priority: admin → vendor → rider → user
        if (profile) {
          const role = profile.role?.toLowerCase().trim();
          
          // Admin role → redirect to admin dashboard
          if (role === "admin") {
            console.log("❌ Vendor Dashboard: User has admin role - redirecting to admin dashboard");
            clearTimeout(timeoutId);
            if (isMounted) {
              router.replace("/admin");
            }
            return;
          }
          
          // Non-vendor role → redirect to appropriate area
          if (role !== "vendor") {
            console.log("❌ Vendor Dashboard: User is not a vendor, role:", profile.role);
            clearTimeout(timeoutId);
            if (isMounted) {
              // Use centralized routing logic
              const redirectResult = getRoleBasedRedirect(profile.role, null);
              router.replace(redirectResult.path);
            }
            return;
          }
        }
        
        // If we don't have a profile, we'll still allow them to stay on dashboard
        // but we'll use fallback data
        if (!profile) {
          console.log("⚠️ Vendor Dashboard: No profile found, using fallback data");
          // Continue with fallback vendor data already set above
        }

        if (!isMounted) {
          clearTimeout(timeoutId);
          return;
        }

        // Only log profile details if profile exists
        if (profile) {
          console.log("✅ Vendor Dashboard: Profile validated, setting vendor data");
          console.log("✅ Vendor Dashboard: Profile name from database:", profile.name);
          console.log("✅ Vendor Dashboard: Profile name type:", typeof profile.name);
          console.log("✅ Vendor Dashboard: Profile name value (raw):", JSON.stringify(profile.name));
          console.log("✅ Vendor Dashboard: Full profile data:", profile);
        }
        
        // CRITICAL: profiles.name is the PRIMARY source for vendor names
        // Fetch name from profiles table - this is where vendor names are stored
        let finalVendorName: string | null = null; // Start with null to track if name was found
        
        // First, try to get name from profiles table (primary source)
        if (profile && profile.name && typeof profile.name === 'string' && profile.name.trim() !== "") {
          finalVendorName = profile.name.trim();
          console.log("✅ Vendor Dashboard: Using profile.name from profiles table:", finalVendorName);
        } else {
          // Profile name is missing - try fallback to vendors table
          console.warn("⚠️ Vendor Dashboard: Profile name is missing or empty");
          if (profile) {
            console.warn("⚠️ Profile data:", { id: profile.id, name: profile.name, email: profile.email });
          }
          console.warn("⚠️ Attempting fallback to vendors table...");
          
          try {
            const { data: vendorTableData, error: vendorError } = await supabase
              .from("vendors")
              .select("business_name, name")
              .eq("profile_id", user.id)
              .single();
            
            if (!vendorError && vendorTableData) {
              const fallbackName = vendorTableData.business_name || vendorTableData.name;
              if (fallbackName && typeof fallbackName === 'string' && fallbackName.trim() !== "") {
                finalVendorName = fallbackName.trim();
                console.log("✅ Vendor Dashboard: Found vendor name from vendors table (fallback):", finalVendorName);
              } else {
                console.warn("⚠️ Vendor Dashboard: Vendor table name is also empty - will use fallback display");
              }
            } else {
              console.warn("⚠️ Vendor Dashboard: Could not fetch from vendors table:", vendorError?.message);
            }
          } catch (vendorFetchError) {
            console.error("❌ Vendor Dashboard: Error fetching vendor data:", vendorFetchError);
          }
        }
        
        // Create vendor data object with the resolved name (null if not found)
        // Only create this if we have a profile
        let vendorData: VendorProfile | null = null;
        if (profile) {
          vendorData = {
            id: profile.id,
            name: finalVendorName, // Will be null if no name was found, actual name otherwise
            email: profile.email || "",
            role: profile.role,
            subscription_plan: profile.subscription_plan,
            is_premium: profile.is_premium || false,
            category: profile.category || null,
          };
        } else {
          // Use fallback vendor data (already set above)
          console.log("✅ Vendor Dashboard: Using fallback vendor data (no profile found)");
          // Don't set vendorData - use the fallback that was already set
        }
        
        // Set vendor state if we have profile data
        if (vendorData && isMounted) {
          console.log("✅ Vendor Dashboard: Final vendor data:", { 
            id: vendorData.id, 
            name: vendorData.name, 
            email: vendorData.email,
            role: vendorData.role
          });
          
          // Use React's automatic batching - all these state updates will be batched together
          setVendor(vendorData);
          setLoading(false);
          
          console.log("✅ Vendor Dashboard: States queued for update");
          console.log("✅ Vendor Dashboard: Vendor ID:", vendorData.id);
          console.log("✅ Vendor Dashboard: Vendor Name:", vendorData.name || "null (will show fallback)");
          console.log("✅ Vendor Dashboard: Vendor Email:", vendorData.email);
        } else if (isMounted) {
          // Ensure we have at least fallback vendor data (only set if not already set)
          if (!vendor || vendor.id === "timeout-fallback" || vendor.id === "timeout" || vendor.id === "unknown") {
            setVendor({
              id: user.id,
              name: null,
              email: user.email || "",
              role: "vendor",
            });
            setLoading(false);
            console.log("✅ Vendor Dashboard: Using fallback vendor data");
          } else {
            // Vendor already set, just update loading state
            setLoading(false);
          }
        }

        // Store vendor ID for fetchOrders function (use profile.id if available, otherwise user.id)
        const vendorIdForQueries = profile?.id || user.id;
        vendorIdRef.current = vendorIdForQueries;

        // Step 4: Fetch menu items
        console.log("🔵 Vendor Dashboard: Fetching menu items...");
        try {
          const { data: menuItemsData, error: menuItemsError } = await supabase
            .from("menu_items")
            .select("id, title, price, availability")
            .eq("vendor_id", vendorIdForQueries)
            .order("created_at", { ascending: false });

          if (menuItemsError) {
            console.error("❌ Vendor Dashboard: Error fetching menu items:", menuItemsError);
            if (isMounted) {
              setMenuItemsError(menuItemsError.message || "Failed to load menu items");
              setMenuItems([]);
            }
          } else {
            console.log(`✅ Vendor Dashboard: Fetched ${menuItemsData?.length || 0} menu items`);
            if (isMounted) {
              setMenuItems(menuItemsData || []);
              setMenuItemsError(null);
            }
          }
        } catch (menuItemsFetchError) {
          console.error("❌ Vendor Dashboard: Exception fetching menu items:", menuItemsFetchError);
          if (isMounted) {
            const errorMessage = menuItemsFetchError instanceof Error ? menuItemsFetchError.message : "An error occurred while fetching menu items";
            setMenuItemsError(errorMessage);
            setMenuItems([]);
          }
        }

        // Step 5: Fetch vendor orders (non-blocking, doesn't block rendering)
        // This happens after the dashboard is already rendered
        console.log("🔵 Vendor Dashboard: Fetching orders...");
        
        // Define fetchOrders function that can be called from anywhere
        const fetchOrders = async (showRefreshing = false) => {
          if (!vendorIdRef.current) {
            console.warn("⚠️ Vendor Dashboard: No vendor ID available for fetching orders");
            return;
          }

          if (showRefreshing && isMounted) {
            setRefreshing(true);
          }

          try {
            setOrdersError(null);
            // Fetch all orders for this vendor (including Pending, Paid, Accepted, etc.)
            // Use explicit column selection to avoid schema mismatch errors
            const { data: ordersData, error: ordersError } = await supabase
              .from("orders")
              .select("id, total_price, food_subtotal, status, created_at, payment_reference")
              .eq("vendor_id", vendorIdRef.current)
              .order("created_at", { ascending: false })
              .limit(100); // Add limit to prevent large queries

            if (ordersError) {
              console.error("❌ Vendor Dashboard: Error fetching orders:", ordersError);
              console.error("❌ Error details:", {
                message: ordersError.message,
                code: ordersError.code,
                details: ordersError.details,
                hint: ordersError.hint
              });
              if (isMounted) {
                setOrders([]);
                setOrdersError(ordersError.message || "Failed to fetch orders. Please refresh the page.");
              }
            } else {
              console.log("✅ Vendor Dashboard: Orders fetched:", ordersData?.length || 0);
              if (isMounted) {
                setOrders(ordersData || []);
                setOrdersError(null);
              }
            }
          } catch (ordersFetchError) {
            console.error("❌ Vendor Dashboard: Exception fetching orders:", ordersFetchError);
            if (isMounted) {
              const errorMessage = ordersFetchError instanceof Error ? ordersFetchError.message : "An error occurred while fetching orders";
              setOrdersError(errorMessage);
            }
          } finally {
            if (isMounted && showRefreshing) {
              setRefreshing(false);
            }
          }
        };

        // Make fetchOrders available globally for the subscription callback
        (window as WindowWithVendorDashboard).__vendorDashboardFetchOrders = fetchOrders;

        // Initial fetch
        await fetchOrders();

        // Set up real-time subscription for new orders
        console.log("🔵 Vendor Dashboard: Setting up real-time subscription...");
        
        // Clean up existing channel if any
        if (channelRef.current) {
          await supabase.removeChannel(channelRef.current);
        }

        const ordersChannel = supabase
          .channel(`vendor-orders-${vendorIdForQueries}-${Date.now()}`)
          .on(
            "postgres_changes",
            {
              event: "*", // Listen to INSERT, UPDATE, DELETE
              schema: "public",
              table: "orders",
              filter: `vendor_id=eq.${vendorIdForQueries}`,
            },
            (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
              console.log("🔄 Vendor Dashboard: Order change detected:", payload);
              // Refetch orders when changes occur
              const windowWithVendorDashboard = window as WindowWithVendorDashboard;
              if (windowWithVendorDashboard.__vendorDashboardFetchOrders) {
                windowWithVendorDashboard.__vendorDashboardFetchOrders(false);
              }
            }
          )
          .subscribe((status: REALTIME_SUBSCRIBE_STATES) => {
            console.log("🔵 Vendor Dashboard: Subscription status:", status);
            if (status === "SUBSCRIBED") {
              console.log("✅ Vendor Dashboard: Real-time subscription active");
            } else if (status === "CHANNEL_ERROR") {
              console.error("❌ Vendor Dashboard: Subscription error");
            }
          });

        // Store channel reference for cleanup
        if (isMounted) {
          channelRef.current = ordersChannel;
        }

        clearTimeout(timeoutId);
      } catch (dashboardError) {
        console.error("❌ Vendor Dashboard: Unexpected error:", dashboardError);
        clearTimeout(timeoutId);
        if (isMounted) {
          // On error, set a default vendor so the dashboard can still render
          // Always set vendor, even if we don't have user data
          setVendor({
            id: currentUser?.id || "unknown",
            name: null, // Use null to trigger fallback display
            email: currentUser?.email || "",
            role: "vendor",
          });
          setLoading(false);
          console.error("❌ Vendor Dashboard: Error occurred, using fallback vendor data");
        }
      }
    };

    loadDashboard();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      // Clean up real-time subscription
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      // Clean up global function
      const windowWithVendorDashboard = window as WindowWithVendorDashboard;
      delete windowWithVendorDashboard.__vendorDashboardFetchOrders;
    };
  }, [router, vendor]); // Include router and vendor in dependencies

  // Refresh orders when page gains focus (user switches back to tab)
  useEffect(() => {
    const handleFocus = () => {
      const windowWithVendorDashboard = window as WindowWithVendorDashboard;
      if (vendorIdRef.current && windowWithVendorDashboard.__vendorDashboardFetchOrders) {
        console.log("🔄 Vendor Dashboard: Page focused, refreshing orders...");
        windowWithVendorDashboard.__vendorDashboardFetchOrders(false);
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  // Show loading screen only if we don't have vendor data yet
  // Once vendor data is available (even if null), render the dashboard
  // This ensures the dashboard renders as soon as data is fetched
  if (!vendor && loading) {
    // Show loading only during initial load when vendor data hasn't been set yet
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-hospineil-base-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hospineil-primary mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg font-medium font-body">Loading your dashboard...</p>
          <p className="text-gray-400 text-sm mt-2 font-body">Please wait while we verify your account</p>
        </div>
      </div>
    );
  }

  // Create display vendor - use actual vendor if available, otherwise use fallback
  // This ensures the dashboard always renders with valid data
  // If vendor is null, use fallback object (will show "Hello 👋 Vendor")
  const displayVendor: VendorProfile = vendor || {
    id: "unknown",
    name: null,
    email: "",
    role: "vendor",
    subscription_plan: undefined,
    is_premium: false,
  };

  // Get vendor name - if null or empty, show fallback message
  const vendorName = displayVendor.name ? displayVendor.name.trim() : null;
  const hasValidName = vendorName && vendorName.length > 0;

  // Calculate earnings summary
  const orderAmount = (order: Order) => order.food_subtotal || order.total_price || 0;
  const totalSales = orders.reduce((sum, order) => sum + orderAmount(order), 0);
  const totalCommission = calculateCommission(totalSales);
  const netEarnings = calculateNetEarnings(totalSales);

  // Filter completed/paid orders for earnings calculation
  const completedOrders = orders.filter(
    (order) => order.status === "Paid" || order.status === "Completed" || order.status === "paid" || order.status === "completed"
  );
  const completedSales = completedOrders.reduce((sum, order) => sum + orderAmount(order), 0);
  const completedCommission = calculateCommission(completedSales);
  const completedNetEarnings = calculateNetEarnings(completedSales);

  // Check if vendor is a cook or chef - render different dashboard
  const isCookOrChef = vendor?.category === 'chef' || vendor?.category === 'home_cook';

  // If cook/chef, render CookChefDashboard
  if (isCookOrChef) {
    return <CookChefDashboard vendor={vendor} />;
  }

  return (
    <div className="w-full min-h-screen bg-hospineil-base-bg">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-hospineil-primary mb-2 font-header">
              {hasValidName ? (
                <>👋 Hello, <span className="text-hospineil-accent">{vendorName}</span></>
              ) : (
                <>Hello 👋 <span className="text-hospineil-accent">Vendor</span></>
              )}
            </h1>
            <p className="text-gray-600 font-body">
              Manage your bookings and payments from here.
            </p>
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              {displayVendor.category && (
                <span className="text-sm text-gray-600 font-body">
                  Category: <span className="font-semibold capitalize text-hospineil-primary">
                    {displayVendor.category.replace("_", " ")}
                  </span>
                </span>
              )}
              {displayVendor.subscription_plan && (
                <span className="text-sm text-gray-600 font-body">
                  Plan: <span className="font-semibold capitalize text-hospineil-primary">
                    {displayVendor.subscription_plan.replace("_", " ")}
                  </span>
                </span>
              )}
              {displayVendor.is_premium && (
                <span className="px-3 py-1 bg-hospineil-accent/20 text-hospineil-accent text-xs font-semibold rounded-full font-button">
                  Premium
                </span>
              )}
              <span className="text-sm text-gray-600 font-body">
                Menu Items: <span className="font-semibold text-hospineil-primary">
                  {menuItems.length}
                </span>
              </span>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button
              variant="outline"
              className="rounded-lg hover:scale-105 transition-all font-button"
              onClick={async () => {
                setRefreshing(true);
                const windowWithVendorDashboard = window as WindowWithVendorDashboard;
                if (windowWithVendorDashboard.__vendorDashboardFetchOrders) {
                  await windowWithVendorDashboard.__vendorDashboardFetchOrders(true);
                }
              }}
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Orders
                </>
              )}
            </Button>
            <Button
              className="bg-hospineil-primary text-white rounded-lg hover:bg-hospineil-primary/90 hover:scale-105 transition-all font-button"
              onClick={() => router.push("/vendor/subscription")}
            >
              Manage Subscription
            </Button>
            <Button
              className="bg-hospineil-accent text-hospineil-light-bg rounded-lg hover:bg-hospineil-accent/90 hover:scale-105 transition-all font-button"
              onClick={() => router.push("/vendor/menu")}
            >
              Manage Menu
            </Button>
          </div>
        </div>
      </div>

      {isValidUuid(displayVendor.id) && (
        <div className="mb-8">
          <VendorPremiumToolsSection vendorId={displayVendor.id} />
        </div>
      )}

      {/* Payout + Commission Notice */}
      <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-300 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-amber-900 font-body font-semibold mb-2">
              Action Required: Create Your Subaccount to Receive Payments
            </p>
            <p className="text-amber-800 font-body text-sm leading-relaxed">
              Please create your Paystack subaccount with accurate details from the Settings page. This is required to receive payouts for all orders.
            </p>
            <p className="text-amber-800 font-body text-sm leading-relaxed mt-2">
              Platform commission: <span className="font-semibold">{PLATFORM_COMMISSION_PERCENT_LABEL} per order</span> (deducted automatically).
            </p>
          </div>
        </div>
      </div>

      {/* Menu Availability Notice */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-blue-800 font-body font-semibold mb-2">
              Important: Menu Item Availability
            </p>
            <p className="text-blue-700 font-body text-sm leading-relaxed">
              Please only upload menu items that are currently available. Remove or unpublish items that are not available, as customers pay for orders before you are notified. Unavailable items can cause failed or delayed orders.
            </p>
          </div>
        </div>
      </div>

      {/* Error Messages */}
      {profileError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 font-body font-semibold mb-2">
            ⚠️ Profile Error
          </p>
          <p className="text-red-700 font-body text-sm">
            {profileError}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </Button>
        </div>
      )}
      
      {ordersError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 font-body font-semibold mb-2">
            ⚠️ Orders Error
          </p>
          <p className="text-red-700 font-body text-sm">
            {ordersError}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={async () => {
              const windowWithVendorDashboard = window as WindowWithVendorDashboard;
              if (windowWithVendorDashboard.__vendorDashboardFetchOrders) {
                await windowWithVendorDashboard.__vendorDashboardFetchOrders(true);
              }
            }}
          >
            Try Again
          </Button>
        </div>
      )}

      {menuItemsError && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 font-body font-semibold mb-2">
            ⚠️ Menu Items Error
          </p>
          <p className="text-yellow-700 font-body text-sm">
            {menuItemsError}
          </p>
        </div>
      )}

      {/* Earnings Summary Section */}
      {orders.length > 0 && (
        <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200 mb-8">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold text-hospineil-primary mb-6 font-header">Earnings Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Total Sales */}
              <div className="bg-hospineil-base-bg rounded-xl p-4 border border-gray-200">
                <p className="text-sm text-gray-600 font-body mb-2">Total Sales</p>
                <p className="text-2xl font-bold text-hospineil-primary font-header">
                  ₦{totalSales.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500 font-body mt-1">
                  {orders.length} {orders.length === 1 ? "order" : "orders"}
                </p>
              </div>

              {/* Total Commission */}
              <div className="bg-hospineil-base-bg rounded-xl p-4 border border-gray-200">
                <p className="text-sm text-gray-600 font-body mb-2">Total Commission ({PLATFORM_COMMISSION_PERCENT_LABEL})</p>
                <p className="text-2xl font-bold text-hospineil-accent font-header">
                  ₦{totalCommission.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500 font-body mt-1">
                  Hospineil platform fee
                </p>
              </div>

              {/* Net Earnings */}
              <div className="bg-hospineil-base-bg rounded-xl p-4 border border-gray-200">
                <p className="text-sm text-gray-600 font-body mb-2">Net Earnings</p>
                <p className="text-2xl font-bold text-green-600 font-header">
                  ₦{netEarnings.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500 font-body mt-1">
                  95% of food subtotal only
                </p>
              </div>
            </div>

            {/* Completed Orders Breakdown */}
            {completedOrders.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-hospineil-primary mb-4 font-header">
                  Completed Orders Earnings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 font-body">Completed Sales</p>
                    <p className="text-xl font-bold text-hospineil-primary font-header">
                      ₦{completedSales.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-body">Commission Deducted</p>
                    <p className="text-xl font-bold text-hospineil-accent font-header">
                      ₦{completedCommission.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-body">Credited to Wallet</p>
                    <p className="text-xl font-bold text-green-600 font-header">
                      ₦{completedNetEarnings.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Orders Section */}
      {orders.length === 0 && !ordersError ? (
        <div className="bg-hospineil-light-bg rounded-2xl shadow-md p-12 text-center">
          <p className="text-gray-600 text-lg font-body mb-4">
            You have no orders yet. When customers book your services, they will appear here.
          </p>
          <Button
            variant="outline"
            onClick={async () => {
              const windowWithVendorDashboard = window as WindowWithVendorDashboard;
              if (windowWithVendorDashboard.__vendorDashboardFetchOrders) {
                await windowWithVendorDashboard.__vendorDashboardFetchOrders(true);
              }
            }}
            disabled={refreshing}
          >
            {refreshing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Check for New Orders
              </>
            )}
          </Button>
        </div>
      ) : orders.length > 0 ? (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-hospineil-primary font-header">Recent Orders</h2>
            <Button
              variant="outline"
              onClick={() => router.push("/vendor/orders")}
              className="font-button"
            >
              View All Orders
            </Button>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {orders.map((order) => {
              const orderAmount = order.food_subtotal || order.total_price || 0;
              const commission = calculateCommission(orderAmount);
              const netEarning = calculateNetEarnings(orderAmount);
              
              return (
                <Card
                  key={order.id}
                  className="bg-hospineil-light-bg rounded-2xl shadow-md hover:shadow-lg hover:scale-105 transition-all border border-gray-200"
                >
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-800 font-header">
                        Order #{order.id.slice(0, 8)}
                      </h3>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold font-button ${
                          order.status === "paid" || order.status === "Paid" || order.status === "Completed" || order.status === "completed"
                            ? "bg-green-500 text-white"
                            : order.status === "pending" || order.status === "Pending"
                            ? "bg-yellow-500 text-white"
                            : "bg-red-500 text-white"
                        }`}
                      >
                        {order.status.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="pt-2 border-t border-gray-300">
                      {/* Order Amount */}
                      <div className="mb-3">
                        <p className="text-hospineil-primary font-bold text-2xl font-header">
                          ₦{orderAmount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 font-body">
                          {new Date(order.created_at).toLocaleString()}
                        </p>
                      </div>

                      {/* Commission Breakdown */}
                      <div className="bg-hospineil-base-bg rounded-lg p-3 border border-gray-200">
                        <p className="text-xs text-gray-600 font-body leading-relaxed">
                          <span className="font-semibold">₦{orderAmount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</span> food subtotal —{" "}
                          <span className="font-semibold text-hospineil-accent">₦{commission.toLocaleString("en-NG", { minimumFractionDigits: 2 })} ({PLATFORM_COMMISSION_PERCENT_LABEL} Hospineil fee)</span> deducted.{" "}
                          <span className="font-semibold text-green-600">₦{netEarning.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</span> vendor earnings.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Menu Items Section */}
      <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200 mt-8">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-hospineil-primary font-header">Menu Items</h2>
            <Button
              className="bg-hospineil-primary text-white rounded-lg hover:bg-hospineil-primary/90 hover:scale-105 transition-all font-button"
              onClick={() => router.push("/vendor/menu")}
            >
              Manage Menu
            </Button>
          </div>

          {menuItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 font-body mb-4">
                You haven&apos;t added any menu items yet.
              </p>
              <Button
                className="bg-hospineil-primary text-white rounded-lg hover:bg-hospineil-primary/90 font-button"
                onClick={() => router.push("/vendor/menu")}
              >
                Add Your First Menu Item
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {menuItems.slice(0, 6).map((item) => (
                <Card
                  key={item.id}
                  className="bg-hospineil-base-bg rounded-xl shadow-sm hover:shadow-md hover:scale-105 transition-all border border-gray-200"
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-semibold text-gray-800 font-header line-clamp-2">
                        {item.title}
                      </h3>
                      <span
                        className={`ml-2 px-2 py-1 rounded-full text-xs font-semibold font-button ${
                          item.availability === "available"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {item.availability === "available" ? "Available" : "Out of Stock"}
                      </span>
                    </div>
                    <p className="text-xl font-bold text-hospineil-primary font-header">
                      ₦{item.price.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {menuItems.length > 6 && (
            <div className="mt-6 text-center">
              <Button
                variant="outline"
                onClick={() => router.push("/vendor/menu")}
                className="font-button"
              >
                View All {menuItems.length} Menu Items
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorDashboard;
