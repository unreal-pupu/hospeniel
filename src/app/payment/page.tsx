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
import { getAuthenticatedUserEmail, initiatePaystackPayment } from "@/lib/paystack";
import Image from "next/image";
import { Loader2, ShoppingBag, Store, CreditCard, ArrowLeft } from "lucide-react";
import { getDeliveryFeeByState, getDeliveryZoneByState, getAvailableStates } from "@/lib/deliveryFees";

interface DirectOrderItem {
  product_id: string;
  vendor_id: string;
  quantity: number;
  total_price: number;
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
  };
}

export default function PaymentPage() {
  const { cartItems, loading: cartLoading } = useCart();
  const [loading, setLoading] = useState(false);
  const [directOrderItems, setDirectOrderItems] = useState<DirectOrderItem[]>([]);
  const [isDirectOrder, setIsDirectOrder] = useState(false);
  const [loadingOrderData, setLoadingOrderData] = useState(true);
  const [deliveryDetails, setDeliveryDetails] = useState({
    address: "",
    phone: "",
    city: "",
    state: "",
  });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [calculatingDelivery, setCalculatingDelivery] = useState(false);
  const [deliveryZone, setDeliveryZone] = useState("");
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] = useState("");
  const [isPaymentLocked, setIsPaymentLocked] = useState(false);
  const router = useRouter();

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
              const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("id, name, location")
                .eq("id", orderData.vendor_id)
                .single();

              // Also try to fetch from vendors table for additional info
              const { data: vendor, error: vendorError } = await supabase
                .from("vendors")
                .select("id, name, business_name, image_url, location, profile_id")
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
                },
              });

              console.log("✅ Successfully loaded order item:", {
                product_id: orderData.product_id,
                menu_title: menuItem.title,
                vendor_name: vendorName,
              });
            } catch (itemError: any) {
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
      acc[vendorId] = {
        vendor: item.vendors || (item as any).vendors,
        items: [],
        subtotal: 0,
      };
    }
    acc[vendorId].items.push(item);
    const price = isDirectOrder ? item.total_price : (item as any).price;
    const quantity = item.quantity;
    acc[vendorId].subtotal += price * quantity;
    return acc;
  }, {} as Record<string, { vendor: any; items: any[]; subtotal: number }>);

  // Calculate overall subtotal (before tax and commission)
  const subtotal = Object.values(groupedByVendor).reduce(
    (sum, group) => sum + group.subtotal,
    0
  );

  // Calculate total items count (moved before delivery charge calculation)
  const totalItems = itemsToDisplay.reduce((sum, item) => sum + item.quantity, 0);

  // Calculate delivery charge when state is selected (state-based pricing)
  useEffect(() => {
    const calculateDeliveryCharge = () => {
      // Only calculate if we have a selected state
      if (!deliveryDetails.state) {
        setDeliveryCharge(0);
        setDeliveryZone("");
        setEstimatedDeliveryTime("");
        return;
      }

      setCalculatingDelivery(true);
      
      // Use state-based pricing from configuration
      const fee = getDeliveryFeeByState(deliveryDetails.state);
      const zone = getDeliveryZoneByState(deliveryDetails.state);
      
      if (fee > 0 && zone) {
        setDeliveryCharge(fee);
        setDeliveryZone(zone.state);
        setEstimatedDeliveryTime("0–30 minutes");
      } else {
        setDeliveryCharge(0);
        setDeliveryZone("");
        setEstimatedDeliveryTime("");
      }
      
      setCalculatingDelivery(false);
    };

    // Calculate immediately when state changes (no debounce needed for state-based pricing)
    calculateDeliveryCharge();
  }, [deliveryDetails.state]);

  // Calculate tax (7.5% VAT on subtotal + delivery charge)
  const TAX_RATE = 0.075;
  const taxableAmount = subtotal + deliveryCharge;
  const taxAmount = taxableAmount * TAX_RATE;

  // Calculate commission (10% of subtotal)
  const COMMISSION_RATE = 0.10;
  const commissionAmount = subtotal * COMMISSION_RATE;

  // Calculate total (subtotal + delivery charge + tax)
  // Note: Commission is deducted from vendor payout, not added to user total
  const total = subtotal + deliveryCharge + taxAmount;

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
  }, [cartItems.length, cartLoading, isDirectOrder, loadingOrderData, directOrderItems.length, router]);

  // Handle payment with Paystack
  const handlePayWithPaystack = async () => {
    if (itemsToDisplay.length === 0) {
      alert("No items to purchase.");
      return;
    }

    // Validate delivery details
    if (!deliveryDetails.address || !deliveryDetails.phone || !deliveryDetails.city || !deliveryDetails.state) {
      alert("Please fill in all required delivery details (address, city, state, and phone number) before proceeding with payment.");
      return;
    }

    // Ensure delivery charge is calculated
    if (deliveryCharge === 0 && deliveryDetails.state) {
      alert("Please select a valid state to calculate delivery charge.");
      return;
    }

    // Lock delivery details once payment is initiated
    setIsPaymentLocked(true);
    setLoading(true);

    try {
      // Get authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        alert("Please login to complete payment.");
        setLoading(false);
        router.push("/loginpage");
        return;
      }

      // Verify session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        alert("Your session has expired. Please log in again.");
        setLoading(false);
        router.push("/loginpage");
        return;
      }

      // Get email for Paystack payment
      const resolvedEmail = (await getAuthenticatedUserEmail()) ?? user.email ?? "";
      if (!resolvedEmail) {
        alert("No email found for the authenticated user.");
        setLoading(false);
        return;
      }

      // Prepare order data (but don't create orders yet - wait for payment success)
      const ordersToInsert: any[] = [];

      if (isDirectOrder) {
        // Use direct order data
        for (const item of directOrderItems) {
          ordersToInsert.push({
            user_id: user.id,
            vendor_id: item.vendor_id,
            product_id: item.product_id,
            quantity: item.quantity,
            total_price: item.total_price,
            status: "Pending",
          });
        }
      } else {
        // Use cart items
        for (const [vendorId, group] of Object.entries(groupedByVendor)) {
          // Create one order per item for this vendor
          for (const item of group.items) {
            ordersToInsert.push({
              user_id: user.id,
              vendor_id: vendorId,
              product_id: item.product_id,
              quantity: item.quantity,
              total_price: (item as any).price * item.quantity,
              status: "Pending",
            });
          }
        }
      }

      // Determine primary vendor (first vendor in the order)
      // For multi-vendor orders, we'll use the first vendor's subaccount
      // In the future, you might want to split payments per vendor
      const primaryVendorId = ordersToInsert.length > 0 ? ordersToInsert[0].vendor_id : null;
      if (!primaryVendorId) {
        alert("Unable to determine vendor. Please try again.");
        setLoading(false);
        return;
      }

      // Create a payment record in pending status with tax, commission, and delivery charge
      const { data: paymentData, error: paymentError } = await supabase
        .from("payments")
        .insert([
          {
            user_id: user.id,
            subtotal: subtotal,
            tax_amount: taxAmount,
            commission_amount: commissionAmount,
            total_amount: total, // total = subtotal + delivery charge + tax
            status: "pending",
          },
        ])
        .select()
        .single();

      if (paymentError) {
        console.error("Error creating payment record:", paymentError);
        alert("Failed to initialize payment. Please try again.");
        setLoading(false);
        return;
      }

      // Store order data, payment ID, delivery details, and delivery charge in sessionStorage for payment handler
      if (typeof window !== "undefined") {
        sessionStorage.setItem("pendingOrdersData", JSON.stringify(ordersToInsert));
        sessionStorage.setItem("paymentId", paymentData.id);
        sessionStorage.setItem("paymentAmount", total.toString());
        sessionStorage.setItem("deliveryDetails", JSON.stringify({
          ...deliveryDetails,
          delivery_charge: deliveryCharge,
        }));
        // Clean up direct order data
        if (isDirectOrder) {
          sessionStorage.removeItem("directOrderData");
          sessionStorage.removeItem("directOrderSource");
        }
      }

      // Initialize Paystack payment with subaccount support via API
      try {
        const initResponse = await fetch("/api/payment/initialize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: resolvedEmail,
            amount: total,
            vendor_id: primaryVendorId,
            payment_id: paymentData.id,
            metadata: {
              order_count: ordersToInsert.length,
              vendor_count: new Set(ordersToInsert.map((o: any) => o.vendor_id)).size,
            },
          }),
        });

        const initData = await initResponse.json();

        if (!initResponse.ok || !initData.success) {
          console.error("Payment initialization error:", initData);
          alert(initData.error || "Failed to initialize payment. Please try again.");
          setLoading(false);
          return;
        }

        // Store payment reference for verification
        if (typeof window !== "undefined") {
          sessionStorage.setItem("paymentReference", initData.reference);
        }

        // Redirect to Paystack payment page
        if (initData.authorization_url) {
          window.location.href = initData.authorization_url;
        } else {
          throw new Error("No authorization URL received from Paystack");
        }
      } catch (paymentError: any) {
        console.error("Error initializing payment:", paymentError);
        alert(`Failed to initialize payment: ${paymentError.message || "Please try again"}`);
        setLoading(false);
      }
    } catch (error: any) {
      console.error("Unexpected error during payment:", error);
      alert(`An unexpected error occurred: ${error.message || "Please try again"}`);
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
      <section className="w-full min-h-screen px-6 md:px-12 lg:px-20 py-16 bg-gradient-to-br from-gray-50 to-indigo-50">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">No Items to Checkout</h1>
            <p className="text-gray-600 mb-6">
              {isDirectOrder 
                ? "Unable to load order details. The item may no longer be available."
                : "Your cart is empty. Add some items before checking out."}
            </p>
            <div className="flex gap-4 justify-center">
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
    <section className="w-full min-h-screen px-6 md:px-12 lg:px-20 py-16 bg-gradient-to-br from-gray-50 to-indigo-50">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              Payment
            </h1>
            <p className="text-gray-600 mt-2">
              Complete your purchase
            </p>
          </div>
          <Link href={isDirectOrder ? "/explore" : "/cart"}>
            <Button variant="outline" className="rounded-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {isDirectOrder ? "Back to Explore" : "Back to Cart"}
            </Button>
          </Link>
        </div>


        <div className="grid md:grid-cols-3 gap-8">
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
                    <div>
                      <Label htmlFor="deliveryAddress" className="text-sm font-medium text-gray-700">
                        Street Address <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="deliveryAddress"
                        value={deliveryDetails.address}
                        onChange={(e) =>
                          !isPaymentLocked && setDeliveryDetails({ ...deliveryDetails, address: e.target.value })
                        }
                        disabled={isPaymentLocked}
                        placeholder="Enter street address"
                        className="mt-1 bg-hospineil-light-bg border-gray-300 focus:ring-2 focus:ring-hospineil-primary focus:border-hospineil-primary transition-all h-11 disabled:opacity-50 disabled:cursor-not-allowed"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Street address, building number, apartment number
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                          onValueChange={(value) =>
                            !isPaymentLocked && setDeliveryDetails({ ...deliveryDetails, state: value })
                          }
                          disabled={isPaymentLocked}
                          required
                        >
                          <SelectTrigger className="mt-1 bg-hospineil-light-bg border-gray-300 focus:ring-2 focus:ring-hospineil-primary focus:border-hospineil-primary transition-all h-11 w-full disabled:opacity-50 disabled:cursor-not-allowed">
                            <SelectValue placeholder="Select state" />
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

                    {calculatingDelivery && deliveryDetails.state && (
                      <div className="flex items-center gap-2 text-sm text-blue-600">
                        <Loader2 className="animate-spin h-4 w-4" />
                        <span>Calculating delivery charge...</span>
                      </div>
                    )}

                    {!calculatingDelivery && deliveryCharge > 0 && deliveryDetails.state && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800">
                          <strong>Delivery Zone:</strong> {deliveryZone}
                        </p>
                        <p className="text-sm text-blue-800 mt-1">
                          <strong>Delivery Charge:</strong> ₦{deliveryCharge.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                        </p>
                        {estimatedDeliveryTime && (
                          <p className="text-xs text-blue-600 mt-1">
                            Estimated delivery time: {estimatedDeliveryTime}
                          </p>
                        )}
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
                              alt={group.vendor.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Store className="h-4 w-4 text-indigo-600" />
                            {group.vendor?.name || "Unknown Vendor"}
                          </h3>
                          {group.vendor?.location && (
                            <p className="text-sm text-gray-600">
                              📍 {group.vendor.location}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Items */}
                      <div className="space-y-3">
                        {group.items.map((item, index) => {
                          const itemId = isDirectOrder ? item.product_id : (item as any).id;
                          const menuItem = isDirectOrder ? item.menu_items : (item as any).menu_items;
                          const price = isDirectOrder ? item.total_price : (item as any).price;
                          const quantity = item.quantity;
                          
                          return (
                            <div
                              key={itemId || index}
                              className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                            >
                              {menuItem?.image_url && (
                                <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                                  <Image
                                    src={menuItem.image_url}
                                    alt={menuItem.title || "Product"}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <h4 className="text-lg font-semibold text-gray-900 truncate">
                                  {menuItem?.title || "Product"}
                                </h4>
                                <p className="text-gray-600">
                                  Quantity: {quantity}
                                </p>
                                <p className="text-indigo-600 font-bold">
                                  ₦{(price * quantity).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
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
            <Card className="rounded-xl shadow-lg border-2 border-indigo-200 sticky top-4">
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

                  {/* Delivery Charge */}
                  {deliveryCharge > 0 ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        Delivery Charge {deliveryZone ? `(${deliveryZone})` : ""}
                      </span>
                      <span className="font-medium">
                        ₦{deliveryCharge.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ) : deliveryDetails.state ? (
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>Delivery Charge</span>
                      <span className="font-medium">
                        {calculatingDelivery ? "Calculating..." : "₦0.00"}
                      </span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>Delivery Charge</span>
                      <span className="font-medium">Select state</span>
                    </div>
                  )}
                  
                  {/* Tax */}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">VAT (7.5%)</span>
                    <span className="font-medium">
                      ₦{taxAmount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Platform Commission (informational, not charged to user) */}
                  <div className="flex justify-between text-xs text-gray-500 border-t pt-2">
                    <span>Platform Commission (10%)</span>
                    <span>
                      ₦{commissionAmount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  
                  {/* Total */}
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-lg font-semibold text-gray-900">Total to Pay</span>
                      <span className="text-2xl font-bold text-indigo-600">
                        ₦{total.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 text-right">
                      (Subtotal + Delivery + Tax)
                    </p>
                    {estimatedDeliveryTime && deliveryCharge > 0 && (
                      <p className="text-xs text-blue-600 text-right mt-1">
                        Estimated delivery: {estimatedDeliveryTime}
                      </p>
                    )}
                  </div>

                  <Button
                    className="w-full rounded-full px-8 py-6 bg-green-600 text-white font-bold text-lg shadow-lg hover:bg-green-700 disabled:opacity-50"
                    onClick={handlePayWithPaystack}
                    disabled={loading}
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin h-5 w-5 mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-5 w-5 mr-2" />
                        Pay with Paystack
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

