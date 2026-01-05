"use client";

import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useCart } from "../../context/CartContex";
import {
  getAuthenticatedUserEmail,
  initiatePaystackPayment,
} from "../../../lib/paystack";
import Script from "next/script";
import { generateVendorSchema, generateBreadcrumbSchema } from "@/lib/seo";

export default function VendorProfile() {
  const params = useParams();
  const router = useRouter();
  const vendorId = Number(params.id);
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();

  // Fetch vendor + menu items from Supabase
  useEffect(() => {
    async function fetchVendor() {
      // Try to fetch from vendors table with menu_items
      const { data: vendorData, error: vendorError } = await supabase
        .from("vendors")
        .select("*, menu_items(*)")
        .eq("id", vendorId)
        .single();

      if (vendorError) {
        // Fallback: try with products table (legacy)
        const { data: legacyData, error: legacyError } = await supabase
          .from("vendors")
          .select("*, products(*)")
          .eq("id", vendorId)
          .single();
        
        if (legacyError) {
          console.error("Error fetching vendor:", legacyError);
          setLoading(false);
          return;
        }
        setVendor(legacyData);
      } else {
        setVendor(vendorData);
      }
      setLoading(false);
    }

    fetchVendor();
  }, [vendorId]);

  // ✅ Handle Paystack Payment (Fixed)
  const handlePay = async (product: any) => {
    try {
      // Verify user is authenticated
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        alert("Please log in to continue with payment.");
        router.push("/loginpage");
        return;
      }

      // Verify session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        alert("Your session has expired. Please log in again.");
        router.push("/loginpage");
        return;
      }

      // Verify user.id is a valid UUID
      if (!user.id || typeof user.id !== 'string' || !user.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        console.error("Invalid user.id:", user.id);
        alert("Invalid user account. Please log out and log in again.");
        return;
      }

      console.log("User info:", {
        id: user.id,
        email: user.email,
        session_exists: !!session,
      });

      // Get vendor's profile_id (auth.users id) - this is what vendor_id in orders should reference
      if (!vendor || !vendor.profile_id) {
        alert("Invalid vendor information. Please try again.");
        return;
      }

      const vendorAuthId = vendor.profile_id; // This is the auth.users(id) UUID

      // Verify vendor_id is a valid UUID
      if (!vendorAuthId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        console.error("Invalid vendor_id:", vendorAuthId);
        alert("Invalid vendor information. Please try again.");
        return;
      }

      // Validate product
      if (!product.id || !product.price) {
        alert("Invalid product information. Please try again.");
        return;
      }

      // Verify product_id is a valid UUID
      if (!product.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        console.error("Invalid product_id:", product.id);
        alert("Invalid product information. Please try again.");
        return;
      }

      const orderData = {
        user_id: user.id, // Use user.id from auth.getUser()
        vendor_id: vendorAuthId, // Use vendor's profile_id (auth.users id)
        product_id: product.id,
        quantity: 1,
        total_price: product.price,
        status: "Pending", // Must match check constraint: 'Pending', 'Accepted', 'Completed', 'Cancelled'
      };

      console.log("Attempting to insert order:", orderData);

      // 1️⃣ Create a pending order in Supabase with correct fields
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert([orderData])
        .select()
        .single();

      if (orderError) {
        console.error("Error creating order:", orderError);
        console.error("Error details:", JSON.stringify(orderError, null, 2));
        
        // Provide specific error messages
        if (orderError.message?.includes("foreign key") || orderError.message?.includes("constraint")) {
          alert(`Data validation error: ${orderError.message}. Please verify the product and vendor information.`);
        } else if (orderError.message?.includes("row-level security") || orderError.message?.includes("RLS")) {
          alert("Permission denied. Please check that you are logged in and have permission to place orders.");
        } else {
          alert(`Failed to create order: ${orderError.message || "Unknown error"}`);
        }
        return;
      }

      // 2️⃣ Get user email for Paystack
      const userEmail = await getAuthenticatedUserEmail() ?? user.email ?? "";
      if (!userEmail) {
        alert("No email found for the authenticated user.");
        return;
      }

      // 3️⃣ Initialize Paystack Payment
      const reference = `order_${order.id}_${Date.now()}`;

      const handler = (window as any).PaystackPop.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
        email: userEmail,
        amount: product.price * 100, // Convert to kobo
        currency: "NGN",
        ref: reference,
        callback: async (response: any) => {
          // 4️⃣ Payment Success → Update order status (Note: orders table doesn't have payment_reference field)
          // Status should be one of: 'Pending', 'Accepted', 'Completed', 'Cancelled'
          // We'll keep it as 'Pending' since payment doesn't mean the vendor has accepted it
          // You may want to add a payment_reference column to orders table if needed
          await supabase
            .from("orders")
            .update({
              status: "Pending", // Keep as Pending - vendor still needs to accept
            })
            .eq("id", order.id);

          alert("Payment successful! 🎉 Your order has been placed.");
        },
        onClose: () => {
          alert("Payment window closed. No transaction was made.");
        },
      });

      handler.openIframe();
    } catch (error: any) {
      console.error("💥 Payment Error:", error);
      alert(`An error occurred while processing your payment: ${error.message || "Unknown error"}`);
    }
  };


  if (loading) {
    return (
      <p className="text-center mt-20 text-gray-500">
        Loading vendor details...
      </p>
    );
  }

  if (!vendor) {
    return <p className="text-center mt-20 text-gray-600">Vendor not found.</p>;
  }

  // Generate structured data for vendor
  const vendorStructuredData = vendor ? generateVendorSchema({
    name: vendor.business_name || vendor.name,
    business_name: vendor.business_name || vendor.name,
    description: vendor.description || vendor.tagline,
    image_url: vendor.logo_url || vendor.image_url,
    location: vendor.location,
    category: vendor.category,
    address: vendor.address,
  }) : null;

  // Generate breadcrumb schema
  const breadcrumbData = vendor ? generateBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Explore", url: "/explore" },
    { name: vendor.business_name || vendor.name || "Vendor", url: `/vendors/${vendorId}` },
  ]) : null;

  return (
    <>
      {/* Structured Data for SEO */}
      {vendorStructuredData && breadcrumbData && (
        <>
          <Script
            id="vendor-structured-data"
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(vendorStructuredData) }}
          />
          <Script
            id="breadcrumb-structured-data"
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
          />
        </>
      )}
      
      <section className="w-full min-h-screen px-6 md:px-12 lg:px-20 py-24 bg-gray-50">
        {/* Vendor Header */}
        <div className="flex flex-col md:flex-row items-center gap-6 mb-12">
          <div className="w-32 h-32 relative rounded-full overflow-hidden shadow-md">
            <Image
              src={vendor.logo_url || vendor.image_url || "/fallback.jpg"}
              alt={vendor.business_name || vendor.name || "Vendor"}
              fill
              className="object-cover"
            />
          </div>
          <div className="space-y-2 text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              {vendor.business_name || vendor.name}
            </h1>
            <p className="text-lg text-gray-600">{vendor.tagline || vendor.description}</p>
            {vendor.category && (
              <span className="inline-block bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium">
                {vendor.category}
              </span>
            )}
          </div>
        </div>

      {/* Menu / Products */}
      <h2 className="text-2xl font-semibold mb-6 text-gray-800">
        Menu / Products
      </h2>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(vendor.menu_items || vendor.products || []).map((product: any) => (
          <Card
            key={product.id}
            className="rounded-xl shadow-md hover:shadow-lg transition"
          >
            <div className="relative w-full h-48">
              <Image
                src={product.image_url || "/default-food.jpg"}
                alt={product.name}
                fill
                className="object-cover rounded-t-xl"
              />
            </div>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {product.name || product.title}
              </h3>
              <p className="text-gray-700 font-medium">₦{product.price}</p>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  className="w-full rounded-full bg-indigo-600 text-white hover:bg-indigo-700"
                  onClick={async () => {
                    try {
                      // Get vendor's profile_id (auth.users id) for the cart item
                      const vendorAuthId = vendor?.profile_id;
                      if (!vendorAuthId) {
                        alert("Unable to add item to cart: vendor information missing.");
                        return;
                      }
                      await addToCart(product.id, vendorAuthId, 1);
                      // Show toast notification
                      const toast = document.createElement("div");
                      toast.className = "fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50";
                      toast.textContent = "✓ Item added to cart!";
                      document.body.appendChild(toast);
                      setTimeout(() => {
                        if (document.body.contains(toast)) {
                          document.body.removeChild(toast);
                        }
                      }, 3000);
                    } catch (error: any) {
                      console.error("Error adding to cart:", error);
                      alert(error.message || "Failed to add item to cart. Please try again.");
                    }
                  }}
                >
                  Add to Cart
                </Button>

                <Button
                  variant="outline"
                  className="w-full rounded-full border-indigo-600 text-indigo-600 hover:bg-indigo-50"
                  onClick={() => handlePay(product)}
                >
                  Pay Now
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
    </>
  );
}
