"use client";

import { useCart } from "../context/CartContex";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { getAuthenticatedUserEmail } from "@/lib/paystack";
import Image from "next/image";
import { Loader2, ShoppingBag, Store, CreditCard, ArrowLeft, Phone } from "lucide-react";
import { 
  getAvailableStates,
  getDeliveryFeeByLandmark,
  getZoneByLandmark,
  getLandmarkInfo,
  getAvailableLandmarks
} from "@/lib/deliveryFees";
import { getOrCreateGuestId } from "@/lib/guestSession";
import {
  isValidGuestId,
  isValidCheckoutPhone,
  isValidCustomerName,
} from "@/lib/guestCheckoutValidation";
import {
  PLATFORM_FOOD_COMMISSION_RATE,
  PLATFORM_SERVICE_CHARGE_NGN,
  calculatePlatformFoodCommission,
} from "@/lib/platformPricing";
import { CheckoutAddressPlacesAssist } from "@/components/checkout/CheckoutAddressPlacesAssist";
import { hasGoogleMapsApiKey, loadGoogleMapsScript } from "@/lib/googleMaps/loadGoogleMapsScript";

interface CheckoutDeliveryDetails {
  address: string;
  phone: string;
  city: string;
  state: string;
  nearest_landmark?: string;
  lat?: number;
  lng?: number;
}

function buildGuestPaystackEmail(guestId: string): string {
  const domain =
    process.env.NEXT_PUBLIC_GUEST_CHECKOUT_EMAIL_DOMAIN || "guest.hospineil.com";
  const safe = guestId.replace(/[^0-9a-f-]/gi, "").slice(0, 36);
  return `guest.${safe}@${domain}`;
}

interface DirectOrderItem {
  product_id: string;
  vendor_id: string;
  quantity: number;
  total_price: number;
  price?: number; // Optional for compatibility with CartItem
  menu_items?: {
    id: string;
    title: string;
    image_url: string;
    price: number;
  };
  vendors?: {
    id: string;
    name: string;
    image_url: string;
    location?: string;
    phone_number?: string | null;
  };
  [key: string]: unknown; // Index signature for compatibility
}

export default function PaymentPage() {
  const { cartItems, loading: cartLoading } = useCart();
  const [loading, setLoading] = useState(false);
  const [directOrderItems, setDirectOrderItems] = useState<DirectOrderItem[]>([]);
  const [isDirectOrder, setIsDirectOrder] = useState(false);
  const [loadingOrderData, setLoadingOrderData] = useState(true);
  const [deliveryDetails, setDeliveryDetails] = useState<CheckoutDeliveryDetails>({
    address: "",
    phone: "",
    city: "",
    state: "Bayelsa", // Default to Bayelsa for landmark-based delivery
  });
  const [selectedLandmark, setSelectedLandmark] = useState("");
  const [manualLandmark, setManualLandmark] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [calculatingDelivery, setCalculatingDelivery] = useState(false);
  const [deliveryZone, setDeliveryZone] = useState("");
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] = useState("");
  const [isPaymentLocked, setIsPaymentLocked] = useState(false);
  const [landmarkError, setLandmarkError] = useState("");
  const resolvedNearestLandmark = (selectedLandmark || manualLandmark).trim();

  const router = useRouter();
  const [checkoutMode, setCheckoutMode] = useState<"loading" | "authenticated" | "guest">("loading");
  const [guestCustomerName, setGuestCustomerName] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (user) {
        setCheckoutMode("authenticated");
      } else {
        setCheckoutMode("guest");
        getOrCreateGuestId();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Preload Maps JS in checkout so the script is in document head before the address field mounts. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasKey = hasGoogleMapsApiKey();
    if (!hasKey) {
      return;
    }
    loadGoogleMapsScript().catch((err) => {
      console.error("[Checkout /payment] Google Maps script failed:", err);
    });
  }, []);

  // Load delivery details from user profile (including admin-entered fields)
  useEffect(() => {
    const loadDeliveryDetails = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoadingProfile(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("address, phone_number, delivery_address_line_1, delivery_city, delivery_state")
          .eq("id", user.id)
          .single();

        if (profile) {
          // Use admin-entered delivery fields if available, otherwise use basic address
          setDeliveryDetails({
            address: profile.delivery_address_line_1 || profile.address || "",
            phone: profile.phone_number || "",
            city: profile.delivery_city || "",
            state: profile.delivery_state || "",
          });
        }
      } catch (error) {
        console.error("Error loading delivery details:", error);
      } finally {
        setLoadingProfile(false);
      }
    };

    loadDeliveryDetails();
  }, []);

  // Check for direct order data
  useEffect(() => {
    const checkDirectOrder = async () => {
      if (typeof window === "undefined") return;

      const directOrderDataStr = sessionStorage.getItem("directOrderData");
      if (directOrderDataStr) {
        try {
          const orderDataArray = JSON.parse(directOrderDataStr);
          
          if (!orderDataArray || orderDataArray.length === 0) {
            console.warn("Direct order data is empty");
            setIsDirectOrder(false);
            setLoadingOrderData(false);
            return;
          }
          
          setIsDirectOrder(true);
          
          // Fetch menu item and vendor details for each order
          const itemsWithDetails: DirectOrderItem[] = [];
          
          for (const orderData of orderDataArray) {
            try {
              console.log("🔄 Fetching details for order:", orderData);
              
              // Fetch menu item details
              const { data: menuItem, error: menuError } = await supabase
                .from("menu_items")
                .select("id, title, image_url, price")
                .eq("id", orderData.product_id)
                .single();

              if (menuError) {
                console.error("❌ Error fetching menu item:", menuError);
                console.error("Menu item ID:", orderData.product_id);
              }

              // Fetch vendor details from profiles table (primary source for vendor names)
              const { data: profile } = await supabase
                .from("profiles")
                .select("id, name, location, phone_number")
                .eq("id", orderData.vendor_id)
                .single();

              // Also try to fetch from vendors table for additional info
              const { data: vendor } = await supabase
                .from("vendors")
                .select("id, name, business_name, image_url, location, profile_id, phone_number")
                .eq("profile_id", orderData.vendor_id)
                .maybeSingle(); // Use maybeSingle() to avoid error if not found

              if (menuError || !menuItem) {
                console.error("❌ Failed to fetch menu item:", menuError);
                // Continue to next item but log the error
                continue;
              }

              // Build vendor info with fallbacks
              let vendorName = "Unknown Vendor";
              let vendorImage = "";
              let vendorLocation: string | undefined = undefined;

              if (profile) {
                vendorName = profile.name || vendorName;
                vendorLocation = profile.location || vendorLocation;
              }

              if (vendor) {
                vendorName = vendor.business_name || vendor.name || vendorName;
                vendorImage = vendor.image_url || vendorImage;
                vendorLocation = vendor.location || vendorLocation;
              }

              const vendorPhone =
                vendor?.phone_number?.trim() || profile?.phone_number?.trim() || "";

              // If we have menu item, create the order item even if vendor fetch failed
              itemsWithDetails.push({
                product_id: orderData.product_id,
                vendor_id: orderData.vendor_id,
                quantity: orderData.quantity,
                total_price: orderData.total_price,
                menu_items: menuItem,
                vendors: {
                  id: vendor?.id || orderData.vendor_id,
                  name: vendorName,
                  image_url: vendorImage,
                  location: vendorLocation,
                  phone_number: vendorPhone || undefined,
                },
              });

              console.log("✅ Successfully loaded order item:", {
                product_id: orderData.product_id,
                menu_title: menuItem.title,
                vendor_name: vendorName,
              });
            } catch (itemError) {
              console.error("❌ Error processing order item:", itemError);
              console.error("Order data:", orderData);
              // Continue to next item
            }
          }

          if (itemsWithDetails.length === 0) {
            console.error("No valid items found in direct order data");
            // Don't redirect here - let the redirect useEffect handle it
          }
          
          setDirectOrderItems(itemsWithDetails);
        } catch (error) {
          console.error("Error parsing direct order data:", error);
          // Fall back to cart
          setIsDirectOrder(false);
        }
      }
      setLoadingOrderData(false);
    };

    checkDirectOrder();
  }, []);

  // Use direct order items if available, otherwise use cart items
  const itemsToDisplay = isDirectOrder ? directOrderItems : cartItems;

  // Group items by vendor
  const groupedByVendor = itemsToDisplay.reduce((acc, item) => {
    const vendorId = item.vendor_id;
    if (!acc[vendorId]) {
      // Safely extract and transform vendors to match expected type
      const itemVendors = item.vendors;
      let vendor: {
        id: string;
        name?: string;
        business_name?: string;
        image_url?: string | null;
        location?: string;
        phone_number?: string | null;
      } | null = null;

      if (itemVendors && typeof itemVendors === "object" && "id" in itemVendors) {
        // Safely access business_name and location by checking if they exist on the object
        const vendorsObj = itemVendors as Record<string, unknown>;
        const businessName = vendorsObj.business_name;
        const location = vendorsObj.location;
        const phoneRaw = vendorsObj.phone_number;
        const phoneStr =
          typeof phoneRaw === "string" ? phoneRaw : phoneRaw === null ? null : undefined;

        vendor = {
          id: typeof itemVendors.id === "string" ? itemVendors.id : "",
          name: typeof itemVendors.name === "string" ? itemVendors.name : undefined,
          business_name: typeof businessName === "string" ? businessName : undefined,
          image_url: typeof itemVendors.image_url === "string" 
            ? itemVendors.image_url 
            : itemVendors.image_url === null 
              ? null 
              : undefined,
          location: typeof location === "string" ? location : undefined,
          phone_number: phoneStr,
        };
      }
      
      acc[vendorId] = {
        vendor,
        items: [],
        subtotal: 0,
      };
    }
    if (!acc[vendorId].vendor && item.vendors && typeof item.vendors === "object") {
      const fallbackPhone = typeof item.vendors.phone_number === "string" ? item.vendors.phone_number : undefined;
      acc[vendorId].vendor = {
        id: typeof item.vendors.id === "string" ? item.vendors.id : vendorId,
        name: typeof item.vendors.name === "string" ? item.vendors.name : "Vendor",
        image_url: typeof item.vendors.image_url === "string" ? item.vendors.image_url : undefined,
        location: typeof item.vendors.location === "string" ? item.vendors.location : undefined,
        phone_number: fallbackPhone,
      };
    }
    acc[vendorId].items.push(item);
    const price = isDirectOrder 
      ? ((item as DirectOrderItem).total_price ?? 0)
      : ((item as import("../context/CartContex").CartItem).price ?? 0);
    const quantity = item.quantity;
    acc[vendorId].subtotal += price * quantity;
    return acc;
  }, {} as Record<string, { vendor: { id: string; name?: string; business_name?: string; image_url?: string | null; location?: string; phone_number?: string | null } | null; items: Array<DirectOrderItem | import("../context/CartContex").CartItem>; subtotal: number }>);

  // Calculate overall subtotal (before tax and commission)
  const subtotal = Object.values(groupedByVendor).reduce(
    (sum, group) => sum + group.subtotal,
    0
  );

  // Calculate total items count (moved before delivery charge calculation)
  const totalItems = itemsToDisplay.reduce((sum, item) => sum + item.quantity, 0);
  const vendorCount = Object.keys(groupedByVendor).length;

  // Calculate delivery charge when landmark is selected (landmark-based pricing)
  useEffect(() => {
    const calculateDeliveryCharge = () => {
      // Only Bayelsa is available, so always use landmark-based pricing
      if (!selectedLandmark) {
        setDeliveryCharge(0);
        setDeliveryZone("");
        setEstimatedDeliveryTime("");
        setLandmarkError("");
        return;
      }

      setCalculatingDelivery(true);
      setLandmarkError("");
      
      // Use landmark-based pricing (internal zone mapping)
      const fee = getDeliveryFeeByLandmark(selectedLandmark);
      const zone = getZoneByLandmark(selectedLandmark);
      const landmarkInfo = getLandmarkInfo(selectedLandmark);
      
      if (fee > 0 && zone && landmarkInfo) {
        const baseDeliveryTotal = fee * Math.max(vendorCount, 1);
        const discount = vendorCount === 2 ? 500 : vendorCount >= 3 ? 800 : 0;
        setDeliveryCharge(Math.max(baseDeliveryTotal - discount, 0));
        setDeliveryZone(selectedLandmark); // Store landmark name only, no zone info in UI
        setEstimatedDeliveryTime("20-40 minutes");
      } else {
        setDeliveryCharge(0);
        setDeliveryZone("");
        setEstimatedDeliveryTime("");
        setLandmarkError("Invalid landmark selected.");
      }
      
      setCalculatingDelivery(false);
    };

    // Calculate immediately when landmark changes
    calculateDeliveryCharge();
  }, [selectedLandmark, vendorCount]);

  // Calculate tax (7.5% VAT on food subtotal only)
  const TAX_RATE = 0.075;
  const taxableAmount = subtotal;
  const taxAmount = taxableAmount * TAX_RATE;

  // Service charge (flat fee for regular orders)
  const serviceCharge = subtotal > 0 ? PLATFORM_SERVICE_CHARGE_NGN : 0;

  const commissionAmount = calculatePlatformFoodCommission(subtotal);

  // Calculate total (subtotal + delivery charge + tax + service charge)
  // Note: Commission is deducted from vendor payout, not added to user total
  const total = subtotal + deliveryCharge + taxAmount + serviceCharge;

  // Redirect to cart if empty (only for cart-based flow)
  useEffect(() => {
    // Only redirect after data loading is complete
    if (loadingOrderData) return; // Wait for data to load
    
    if (!isDirectOrder && !cartLoading && cartItems.length === 0) {
      // Cart is empty and not a direct order - redirect to cart
      console.log("🔄 Cart is empty, redirecting to cart page");
      router.push("/cart");
    } else if (isDirectOrder && !loadingOrderData) {
      // Check if we have any items loaded
      if (directOrderItems.length === 0) {
        // Direct order was attempted but data failed to load
        console.error("❌ Direct order data failed to load or is empty");
        console.error("Direct order items:", directOrderItems);
        console.error("Is direct order:", isDirectOrder);
        console.error("Loading state:", loadingOrderData);
        
        // Check if there's still data in sessionStorage
        const directOrderDataStr = typeof window !== "undefined" 
          ? sessionStorage.getItem("directOrderData") 
          : null;
        console.error("SessionStorage data:", directOrderDataStr);
        
        // Try to fall back to cart if available
        if (cartItems.length > 0) {
          console.log("🔄 Falling back to cart items");
          setIsDirectOrder(false);
          return; // Don't redirect, use cart instead
        }
        
        // Only redirect if we truly have no data
        alert("Unable to load order details. Please try adding the item to your cart first.");
        router.push("/explore");
      } else {
        console.log("✅ Direct order items loaded successfully:", directOrderItems.length);
      }
    }
  }, [cartItems.length, cartLoading, isDirectOrder, loadingOrderData, directOrderItems, router]);

  // Handle payment with Paystack
  const handlePayWithPaystack = async () => {
    console.log("🔄 handlePayWithPaystack called");
    console.log("📦 itemsToDisplay:", itemsToDisplay);
    console.log("📋 deliveryDetails:", deliveryDetails);
    console.log("💰 deliveryCharge:", deliveryCharge);
    
    if (itemsToDisplay.length === 0) {
      console.error("❌ No items to display");
      alert("No items to purchase.");
      return;
    }

    // Validate delivery details
    if (!deliveryDetails.phone || !deliveryDetails.city || !deliveryDetails.state) {
      console.error("❌ Missing delivery details:", {
        phone: !!deliveryDetails.phone,
        city: !!deliveryDetails.city,
        state: !!deliveryDetails.state,
      });
      alert("Please fill in all required delivery details (city, state, and phone number) before proceeding with payment.");
      return;
    }

    const hasStreetAddress = deliveryDetails.address.trim().length > 0;
    const hasNearestLandmark = resolvedNearestLandmark.length > 0;
    if (!hasStreetAddress && !hasNearestLandmark) {
      console.error("❌ Neither street address nor nearest landmark provided");
      alert("Please provide at least one location detail: street address or nearest landmark.");
      return;
    }

    if (!isValidCheckoutPhone(deliveryDetails.phone)) {
      alert("Please enter a valid phone number (at least 10 digits).");
      return;
    }

    console.log("✅ Validation passed, proceeding with payment");

    setIsPaymentLocked(true);
    setLoading(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      const isLoggedIn = !userError && !!user;

      interface OrderLineGuest {
        user_id: null;
        guest_id: string;
        vendor_id: string;
        product_id: string;
        quantity: number;
        total_price: number;
        status: string;
        customer_name: string;
        customer_phone: string;
      }

      interface OrderLineAuth {
        user_id: string;
        vendor_id: string;
        product_id: string;
        quantity: number;
        total_price: number;
        status: string;
      }

      let resolvedEmail = "";
      let paymentData: { id: string };
      let ordersToInsert: Array<OrderLineGuest | OrderLineAuth> = [];

      if (!isLoggedIn) {
        if (!isValidCustomerName(guestCustomerName)) {
          alert("Please enter your full name (at least 2 characters).");
          setLoading(false);
          setIsPaymentLocked(false);
          return;
        }
        const guestId = getOrCreateGuestId();
        if (!isValidGuestId(guestId)) {
          alert("Could not start guest checkout. Please enable local storage or try another browser.");
          setLoading(false);
          setIsPaymentLocked(false);
          return;
        }

        const guestLines: OrderLineGuest[] = [];
        const trimmedName = guestCustomerName.trim();
        const trimmedPhone = deliveryDetails.phone.trim();

        if (isDirectOrder) {
          for (const item of directOrderItems) {
            guestLines.push({
              user_id: null,
              guest_id: guestId,
              vendor_id: item.vendor_id,
              product_id: item.product_id,
              quantity: item.quantity,
              total_price: item.total_price,
              status: "Pending",
              customer_name: trimmedName,
              customer_phone: trimmedPhone,
            });
          }
        } else {
          for (const [vendorId, group] of Object.entries(groupedByVendor)) {
            for (const item of group.items) {
              guestLines.push({
                user_id: null,
                guest_id: guestId,
                vendor_id: vendorId,
                product_id: item.product_id,
                quantity: item.quantity,
                total_price: ((item as { price?: number }).price || 0) * item.quantity,
                status: "Pending",
                customer_name: trimmedName,
                customer_phone: trimmedPhone,
              });
            }
          }
        }

        ordersToInsert = guestLines;
        const primaryVendorIdGuest =
          ordersToInsert.length > 0 ? ordersToInsert[0].vendor_id : null;
        if (!primaryVendorIdGuest) {
          alert("Unable to determine vendor. Please try again.");
          setLoading(false);
          setIsPaymentLocked(false);
          return;
        }

        const intentRes = await fetch("/api/payment/create-pending-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guest_id: guestId,
            subtotal,
            tax_amount: taxAmount,
            commission_amount: commissionAmount,
            total_amount: total,
          }),
        });
        const intentJson = await intentRes.json();
        if (!intentRes.ok || !intentJson?.id) {
          alert(intentJson?.error || "Failed to initialize payment. Please try again.");
          setLoading(false);
          setIsPaymentLocked(false);
          return;
        }
        paymentData = { id: intentJson.id as string };
        resolvedEmail = buildGuestPaystackEmail(guestId);
      } else {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          alert("Your session has expired. Please log in again.");
          setLoading(false);
          setIsPaymentLocked(false);
          router.push("/loginpage");
          return;
        }

        resolvedEmail = (await getAuthenticatedUserEmail()) ?? user.email ?? "";
        if (!resolvedEmail) {
          alert("No email found for the authenticated user.");
          setLoading(false);
          setIsPaymentLocked(false);
          return;
        }

        const authLines: OrderLineAuth[] = [];
        if (isDirectOrder) {
          for (const item of directOrderItems) {
            authLines.push({
              user_id: user.id,
              vendor_id: item.vendor_id,
              product_id: item.product_id,
              quantity: item.quantity,
              total_price: item.total_price,
              status: "Pending",
            });
          }
        } else {
          for (const [vendorId, group] of Object.entries(groupedByVendor)) {
            for (const item of group.items) {
              authLines.push({
                user_id: user.id,
                vendor_id: vendorId,
                product_id: item.product_id,
                quantity: item.quantity,
                total_price: ((item as { price?: number }).price || 0) * item.quantity,
                status: "Pending",
              });
            }
          }
        }

        ordersToInsert = authLines;
        const { data: insertedPayment, error: paymentError } = await supabase
          .from("payments")
          .insert([
            {
              user_id: user.id,
              subtotal: subtotal,
              tax_amount: taxAmount,
              commission_amount: commissionAmount,
              total_amount: total,
              status: "pending",
            },
          ])
          .select()
          .single();

        if (paymentError || !insertedPayment?.id) {
          console.error("Error creating payment record:", paymentError);
          alert("Failed to initialize payment. Please try again.");
          setLoading(false);
          setIsPaymentLocked(false);
          return;
        }
        paymentData = { id: insertedPayment.id };
      }

      const primaryVendorId = ordersToInsert.length > 0 ? ordersToInsert[0].vendor_id : null;
      if (!primaryVendorId) {
        alert("Unable to determine vendor. Please try again.");
        setLoading(false);
        setIsPaymentLocked(false);
        return;
      }

      const deliveryPayload = {
        ...deliveryDetails,
        delivery_zone: deliveryZone || resolvedNearestLandmark || null,
        delivery_charge: deliveryCharge,
        service_charge: serviceCharge,
        landmark: deliveryDetails.state === "Bayelsa" ? resolvedNearestLandmark || null : null,
        nearest_landmark: resolvedNearestLandmark || null,
        street_address: deliveryDetails.address.trim() || null,
        customer_name: !isLoggedIn ? guestCustomerName.trim() : undefined,
        customer_phone: deliveryDetails.phone.trim(),
      };

      if (typeof window !== "undefined") {
        sessionStorage.setItem("pendingOrdersData", JSON.stringify(ordersToInsert));
        sessionStorage.setItem("paymentId", paymentData.id);
        sessionStorage.setItem("paymentAmount", total.toString());
        sessionStorage.setItem("deliveryDetails", JSON.stringify(deliveryPayload));
        if (isDirectOrder) {
          sessionStorage.removeItem("directOrderData");
          sessionStorage.removeItem("directOrderSource");
        }
      }

      try {
        const initResponse = await fetch("/api/payment/initialize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: resolvedEmail,
            amount: total,
            food_amount: subtotal,
            delivery_fee: deliveryCharge,
            service_charge: serviceCharge,
            vat_amount: taxAmount,
            vendor_id: primaryVendorId,
            payment_id: paymentData.id,
            pending_orders: ordersToInsert,
            delivery_details: deliveryPayload,
            metadata: {
              order_count: ordersToInsert.length,
              vendor_count: new Set(ordersToInsert.map((o) => o.vendor_id)).size,
              service_charge: serviceCharge,
            },
          }),
        });

        const initData = await initResponse.json();

        if (!initResponse.ok || !initData.success) {
          console.error("Payment initialization error:", initData);
          alert(initData.error || "Failed to initialize payment. Please try again.");
          setLoading(false);
          setIsPaymentLocked(false);
          return;
        }

        if (typeof window !== "undefined") {
          sessionStorage.setItem("paymentReference", initData.reference);
        }

        if (initData.authorization_url) {
          window.location.href = initData.authorization_url;
        } else {
          throw new Error("No authorization URL received from Paystack");
        }
      } catch (paymentError) {
        console.error("Error initializing payment:", paymentError);
        const errorMessage = paymentError instanceof Error ? paymentError.message : "Please try again";
        alert(`Failed to initialize payment: ${errorMessage}`);
        setLoading(false);
        setIsPaymentLocked(false);
      }
    } catch (error) {
      console.error("Unexpected error during payment:", error);
      const errorMessage = error instanceof Error ? error.message : "Please try again";
      alert(`An unexpected error occurred: ${errorMessage}`);
      setLoading(false);
    }
  };


  if (cartLoading || loadingOrderData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-indigo-600 h-8 w-8 mb-4" />
        <p className="text-gray-600">Loading order details...</p>
        {isDirectOrder && (
          <p className="text-sm text-gray-500 mt-2">Fetching menu item and vendor information...</p>
        )}
      </div>
    );
  }

  if (itemsToDisplay.length === 0) {
    // Show a helpful message instead of just redirecting
    return (
      <section className="w-full min-h-screen max-w-[100vw] overflow-x-hidden px-3 sm:px-6 md:px-12 lg:px-20 py-8 sm:py-16 bg-gradient-to-br from-gray-50 to-indigo-50">
        <div className="max-w-2xl mx-auto text-center min-w-0 px-1">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">No Items to Checkout</h1>
            <p className="text-gray-600 mb-6">
              {isDirectOrder 
                ? "Unable to load order details. The item may no longer be available."
                : "Your cart is empty. Add some items before checking out."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <Link href="/explore">
                <Button className="rounded-full px-6">
                  Browse Menu Items
                </Button>
              </Link>
              {!isDirectOrder && (
                <Link href="/cart">
                  <Button variant="outline" className="rounded-full px-6">
                    View Cart
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full min-h-screen max-w-[100vw] overflow-x-hidden px-3 sm:px-6 md:px-12 lg:px-20 py-8 sm:py-16 bg-gradient-to-br from-gray-50 to-indigo-50">
      <div className="max-w-4xl mx-auto min-w-0 w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
          <div className="min-w-0">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              Payment
            </h1>
            <p className="text-gray-600 mt-2">
              Complete your purchase
            </p>
          </div>
          <Link href={isDirectOrder ? "/explore" : "/cart"} className="w-full sm:w-auto">
            <Button variant="outline" className="rounded-full w-full sm:w-auto">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {isDirectOrder ? "Back to Explore" : "Back to Cart"}
            </Button>
          </Link>
        </div>


        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 min-w-0">
          {/* Order Summary and Delivery Details */}
          <div className="md:col-span-2 space-y-6">
            {/* Delivery Details Section */}
            <Card className="rounded-xl shadow-md">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b">
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-indigo-600" />
                  Delivery Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {loadingProfile ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="animate-spin text-indigo-600 h-6 w-6" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {checkoutMode === "guest" && (
                      <div className="rounded-lg border border-indigo-200 bg-indigo-50/80 p-4 space-y-3">
                        <p className="text-sm text-indigo-900 font-medium">Checkout as a guest</p>
                        <p className="text-xs text-indigo-800">
                          No account needed. You can also{" "}
                          <Link href="/loginpage" className="underline font-semibold">
                            sign in
                          </Link>{" "}
                          to use saved addresses.
                        </p>
                      </div>
                    )}

                    {checkoutMode === "guest" && (
                      <div>
                        <Label htmlFor="guestFullName" className="text-sm font-medium text-gray-700">
                          Full name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="guestFullName"
                          value={guestCustomerName}
                          onChange={(e) =>
                            !isPaymentLocked && setGuestCustomerName(e.target.value)
                          }
                          disabled={isPaymentLocked}
                          placeholder="Your name"
                          className="mt-1 bg-hospineil-light-bg border-gray-300 focus:ring-2 focus:ring-hospineil-primary focus:border-hospineil-primary transition-all h-11 disabled:opacity-50 disabled:cursor-not-allowed"
                          autoComplete="name"
                          required
                        />
                      </div>
                    )}

                    <div>
                      <Label htmlFor="deliveryAddress" className="text-sm font-medium text-gray-700">
                        Street Address
                      </Label>
                      <Input
                        id="deliveryAddress"
                        value={deliveryDetails.address}
                        onChange={(e) => {
                          if (isPaymentLocked) return;
                          setDeliveryDetails((prev) => ({
                            ...prev,
                            address: e.target.value,
                            lat: undefined,
                            lng: undefined,
                          }));
                        }}
                        disabled={isPaymentLocked}
                        placeholder="Enter street address"
                        className="mt-1 bg-hospineil-light-bg border-gray-300 focus:ring-2 focus:ring-hospineil-primary focus:border-hospineil-primary transition-all h-11 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Street address, building number, apartment number. Optional if nearest landmark is provided.
                      </p>
                      <CheckoutAddressPlacesAssist
                        addressInputId="deliveryAddress"
                        enabled={!loadingProfile}
                        disabled={isPaymentLocked}
                        onPlaceResolved={({ formattedAddress, lat, lng }) => {
                          setDeliveryDetails((prev) => ({
                            ...prev,
                            address: formattedAddress,
                            lat,
                            lng,
                          }));
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="deliveryCity" className="text-sm font-medium text-gray-700">
                          City <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="deliveryCity"
                          value={deliveryDetails.city}
                          onChange={(e) =>
                            !isPaymentLocked && setDeliveryDetails({ ...deliveryDetails, city: e.target.value })
                          }
                          placeholder="Enter city"
                          className="mt-1 bg-hospineil-light-bg border-gray-300 focus:ring-2 focus:ring-hospineil-primary focus:border-hospineil-primary transition-all h-11 disabled:opacity-50 disabled:cursor-not-allowed"
                          required
                          disabled={isPaymentLocked}
                        />
                      </div>

                      <div>
                        <Label htmlFor="deliveryState" className="text-sm font-medium text-gray-700">
                          State <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={deliveryDetails.state}
                          onValueChange={(value) => {
                            if (!isPaymentLocked) {
                              setDeliveryDetails({ ...deliveryDetails, state: value });
                              // Reset landmark when state changes
                              if (value !== "Bayelsa") {
                                setSelectedLandmark("");
                              }
                            }
                          }}
                          disabled={isPaymentLocked} // Disabled only when payment is locked
                          required
                        >
                          <SelectTrigger className="mt-1 bg-hospineil-light-bg border-gray-300 focus:ring-2 focus:ring-hospineil-primary focus:border-hospineil-primary transition-all h-11 w-full disabled:opacity-50 disabled:cursor-not-allowed">
                            <SelectValue placeholder="Bayelsa" />
                          </SelectTrigger>
                          <SelectContent>
                            {getAvailableStates().map((state) => (
                              <SelectItem key={state} value={state}>
                                {state}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Landmark Selection - Always shown since only Bayelsa is available */}
                    <div>
                      <Label htmlFor="deliveryLandmark" className="text-sm font-medium text-gray-700">
                        Choose Closest Landmark (Optional)
                      </Label>
                        <Select
                          value={selectedLandmark}
                          onValueChange={(value) =>
                            !isPaymentLocked && setSelectedLandmark(value)
                          }
                          disabled={isPaymentLocked}
                        >
                          <SelectTrigger className="mt-1 bg-hospineil-light-bg border-gray-300 focus:ring-2 focus:ring-hospineil-primary focus:border-hospineil-primary transition-all h-11 w-full disabled:opacity-50 disabled:cursor-not-allowed">
                            <SelectValue placeholder="Select closest landmark" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {getAvailableLandmarks().map((landmark) => (
                              <SelectItem key={landmark} value={landmark}>
                                {landmark}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      {landmarkError && (
                        <p className="text-xs text-red-600 mt-1">{landmarkError}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        Street address is optional if landmark is provided.
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="manualLandmark" className="text-sm font-medium text-gray-700">
                        Manual Nearest Landmark (Fallback)
                      </Label>
                      <Input
                        id="manualLandmark"
                        value={manualLandmark}
                        onChange={(e) => !isPaymentLocked && setManualLandmark(e.target.value)}
                        disabled={isPaymentLocked}
                        placeholder="e.g., Opposite Tombia Roundabout"
                        className="mt-1 bg-hospineil-light-bg border-gray-300 focus:ring-2 focus:ring-hospineil-primary focus:border-hospineil-primary transition-all h-11 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Use this if Google Maps autocomplete is unavailable or no suggestion matches your address.
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="deliveryPhone" className="text-sm font-medium text-gray-700">
                        Phone Number <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="deliveryPhone"
                        type="tel"
                        value={deliveryDetails.phone}
                        onChange={(e) =>
                          !isPaymentLocked && setDeliveryDetails({ ...deliveryDetails, phone: e.target.value.replace(/[^\d+]/g, "") })
                        }
                        placeholder="e.g., +2348012345678"
                        className="mt-1 bg-hospineil-light-bg border-gray-300 focus:ring-2 focus:ring-hospineil-primary focus:border-hospineil-primary transition-all h-11 disabled:opacity-50 disabled:cursor-not-allowed"
                        required
                        disabled={isPaymentLocked}
                      />
                    </div>

                    {calculatingDelivery && selectedLandmark && (
                      <div className="flex items-center gap-2 text-sm text-blue-600">
                        <Loader2 className="animate-spin h-4 w-4" />
                        <span>Calculating delivery fee...</span>
                      </div>
                    )}

                    {!calculatingDelivery && deliveryCharge > 0 && selectedLandmark && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800">
                          <strong>Delivery Fee:</strong> ₦{deliveryCharge.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                        </p>
                        {estimatedDeliveryTime && (
                          <p className="text-xs text-blue-600 mt-1">
                            Estimated delivery time: {estimatedDeliveryTime}
                          </p>
                        )}
                      </div>
                    )}

                    {!selectedLandmark && !manualLandmark.trim() && !deliveryDetails.address.trim() && !calculatingDelivery && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-sm text-yellow-800">
                          Provide either a street address or a nearest landmark to continue checkout.
                        </p>
                      </div>
                    )}

                    {isPaymentLocked && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-xs text-yellow-800">
                          <strong>Note:</strong> Delivery details are locked. To make changes, please go back and start over.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Items */}
            <Card className="rounded-xl shadow-md">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-indigo-600" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  {Object.entries(groupedByVendor).map(([vendorId, group]) => (
                    <div key={vendorId} className="space-y-4">
                      {/* Vendor Header */}
                      <div className="flex items-center gap-3 pb-3 border-b">
                        {group.vendor?.image_url && (
                          <div className="relative w-10 h-10 rounded-full overflow-hidden">
                            <Image
                              src={group.vendor.image_url}
                              alt={group.vendor.name || "Vendor"}
                              fill
                              className="object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Store className="h-4 w-4 text-indigo-600" />
                            {group.vendor?.name || group.vendor?.business_name || "Unknown Vendor"}
                          </h3>
                          {group.vendor?.location && (
                            <p className="text-sm text-gray-600">
                              📍 {group.vendor.location}
                            </p>
                          )}
                          <p className="text-sm text-gray-600 flex flex-wrap items-center gap-1.5 mt-1">
                            <Phone className="h-3.5 w-3.5 shrink-0 text-indigo-600" aria-hidden />
                            <span className="font-medium text-gray-700">Vendor phone number:</span>
                            {group.vendor?.phone_number?.trim() ? (
                              <a
                                href={`tel:${group.vendor.phone_number.replace(/\s/g, "")}`}
                                className="text-indigo-600 hover:underline font-medium break-all"
                              >
                                {group.vendor.phone_number.trim()}
                              </a>
                            ) : (
                              <span className="text-gray-500">Not available</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="space-y-3">
                        {group.items.map((item, index) => {
                          interface CartItem {
                            id?: string;
                            product_id?: string;
                            menu_items?: {
                              id: string;
                              title: string;
                              image_url: string;
                              price: number;
                            };
                            price?: number;
                            total_price?: number;
                            quantity: number;
                            [key: string]: unknown;
                          }
                          const cartItem = item as CartItem;
                          const itemId = isDirectOrder ? cartItem.product_id : cartItem.id;
                          const menuItem: { id: string; title: string; image_url: string; price: number } | undefined = isDirectOrder ? cartItem.menu_items : cartItem.menu_items;
                          const price = isDirectOrder ? cartItem.total_price : cartItem.price;
                          const quantity = item.quantity;
                          
                          return (
                            <div
                              key={itemId || index}
                              className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                            >
                              {menuItem?.image_url && (
                      <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden flex-shrink-0">
                                  <Image
                                    src={menuItem.image_url}
                                    alt={menuItem.title || "Product"}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <h4 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                                  {menuItem?.title || "Product"}
                                </h4>
                                <p className="text-gray-600">
                                  Quantity: {quantity}
                                </p>
                                <p className="text-indigo-600 font-bold">
                                  ₦{((price ?? 0) * quantity).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Vendor Subtotal */}
                      <div className="flex justify-between items-center pt-3 border-t">
                        <span className="text-gray-600 font-medium">
                          Subtotal ({group.items.length} {group.items.length === 1 ? "item" : "items"})
                        </span>
                        <span className="text-lg font-bold text-indigo-600">
                          ₦{group.subtotal.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Summary */}
          <div className="md:col-span-1">
            <Card className="rounded-xl shadow-lg border-2 border-indigo-200 md:sticky md:top-24 lg:top-28 z-10">
              <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Subtotal */}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal ({totalItems} {totalItems === 1 ? "item" : "items"})</span>
                    <span className="font-medium">
                      ₦{subtotal.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Delivery Fee */}
                  {deliveryCharge > 0 ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        Delivery Fee
                      </span>
                      <span className="font-medium">
                        ₦{deliveryCharge.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>Delivery Fee</span>
                      <span className="font-medium">
                        {calculatingDelivery ? "Calculating..." : "₦0.00"}
                      </span>
                    </div>
                  )}
                  
                  {/* Service Charge */}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Service Charge</span>
                    <span className="font-medium">
                      ₦{serviceCharge.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Tax */}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">VAT (7.5%)</span>
                    <span className="font-medium">
                      ₦{taxAmount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Total */}
                  <div className="border-t pt-4">
                    <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                      <span className="text-base sm:text-lg font-semibold text-gray-900">Total to Pay</span>
                      <span className="text-xl sm:text-2xl font-bold text-indigo-600 break-all">
                        ₦{total.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 text-right">
                      (Subtotal + Delivery + Tax + Service Charge)
                    </p>
                    {estimatedDeliveryTime && deliveryCharge > 0 && (
                      <p className="text-xs text-blue-600 text-right mt-1">
                        Estimated delivery: {estimatedDeliveryTime}
                      </p>
                    )}
                  </div>
                 

                  <Button
                    className="w-full rounded-full px-8 py-6 bg-green-600 text-white font-bold text-lg shadow-lg hover:bg-green-700 disabled:opacity-50"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log("🔵 Button clicked, calling handlePayWithPaystack");
                      if (typeof handlePayWithPaystack === 'function') {
                        handlePayWithPaystack();
                      } else {
                        console.error("❌ handlePayWithPaystack is not a function:", typeof handlePayWithPaystack);
                        alert("Payment handler is not available. Please refresh the page.");
                      }
                    }}
                    disabled={loading || itemsToDisplay.length === 0}
                    size="lg"
                    type="button"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin h-5 w-5 mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-5 w-5 mr-2" />
                        {itemsToDisplay.length === 0 ? "No items to purchase" : "Pay with Paystack"}
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-gray-500 text-center">
                    Secure payment powered by Paystack
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}













