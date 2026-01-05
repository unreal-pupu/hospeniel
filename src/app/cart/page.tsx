"use client";

import { useCart } from "../context/CartContex";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FiTrash2, FiPlus, FiMinus } from "react-icons/fi";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, ShoppingBag, Store } from "lucide-react";
import { useState, useEffect } from "react";

export default function CartPage() {
  const { cartItems, removeFromCart, updateQuantity, loading: cartLoading } = useCart();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAuth();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Group cart items by vendor
  const groupedByVendor = cartItems.reduce((acc, item) => {
    const vendorId = item.vendor_id;
    if (!acc[vendorId]) {
      acc[vendorId] = {
        vendor: item.vendors,
        items: [],
        subtotal: 0,
      };
    }
    acc[vendorId].items.push(item);
    acc[vendorId].subtotal += item.price * item.quantity;
    return acc;
  }, {} as Record<string, { vendor: any; items: typeof cartItems; subtotal: number }>);

  // Calculate overall total
  const total = Object.values(groupedByVendor).reduce(
    (sum, group) => sum + group.subtotal,
    0
  );

  // Calculate total items count
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Handle checkout - redirect to payment page or login if not authenticated
  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      alert("Your cart is empty.");
      return;
    }

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      // Store return URL in sessionStorage for redirect after login
      if (typeof window !== "undefined") {
        sessionStorage.setItem("returnUrl", "/payment");
      }
      alert("Please login to checkout.");
      router.push("/loginpage");
      return;
    }

    // Redirect to payment page
    router.push("/payment");
  };

  if (cartLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-indigo-600 h-8 w-8 mb-4" />
        <p className="text-gray-600">Loading your cart...</p>
      </div>
    );
  }

  return (
    <section className="w-full min-h-screen px-6 md:px-12 lg:px-20 py-16 bg-gradient-to-br from-gray-50 to-indigo-50">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            Your Cart
          </h1>
          <p className="text-gray-600 mt-2">
            {totalItems} {totalItems === 1 ? "item" : "items"} from {Object.keys(groupedByVendor).length} {Object.keys(groupedByVendor).length === 1 ? "vendor" : "vendors"}
          </p>
        </div>
        <Link href="/explore">
          <Button variant="outline" className="rounded-full">
            ← Back to Explore
          </Button>
        </Link>
      </div>


      {cartItems.length === 0 ? (
        <Card className="p-12 text-center">
          <ShoppingBag className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Your cart is empty</h3>
          <p className="text-gray-600 mb-6">
            Start adding some delicious items from our vendors!
          </p>
          <Link href="/explore">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Browse Menu
            </Button>
          </Link>
        </Card>
      ) : (
        <>
          {/* Message for unauthenticated users */}
          {isAuthenticated === false && (
            <Card className="mb-6 bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      💡 You're shopping as a guest
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      Sign in or create an account to save your cart and checkout securely
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link href="/loginpage">
                      <Button variant="outline" size="sm" className="border-blue-300 text-blue-700 hover:bg-blue-100">
                        Sign In
                      </Button>
                    </Link>
                    <Link href="/register">
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                        Sign Up
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        <div className="space-y-8">
          {/* Group items by vendor */}
          {Object.entries(groupedByVendor).map(([vendorId, group]) => (
            <Card key={vendorId} className="rounded-xl shadow-md">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b">
                <div className="flex items-center gap-3">
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
                    <CardTitle className="flex items-center gap-2">
                      <Store className="h-5 w-5 text-indigo-600" />
                      {group.vendor?.name || "Unknown Vendor"}
                    </CardTitle>
                    {group.vendor?.location && (
                      <p className="text-sm text-gray-600 mt-1">
                        📍 {group.vendor.location}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Subtotal</p>
                    <p className="text-lg font-bold text-indigo-600">
                      ₦{group.subtotal.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg"
                    >
                      {/* Product Info */}
                      <div className="flex items-center gap-4 flex-1 w-full md:w-auto">
                        {item.menu_items?.image_url && (
                          <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                            <Image
                              src={item.menu_items.image_url}
                              alt={item.menu_items.title || "Product"}
                              fill
                              className="object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 truncate">
                            {item.menu_items?.title || "Product"}
                          </h3>
                          <p className="text-gray-600">
                            ₦{item.price.toLocaleString("en-NG", { minimumFractionDigits: 2 })} × {item.quantity}
                          </p>
                          <p className="text-indigo-600 font-bold">
                            ₦{(item.price * item.quantity).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                        >
                          <FiMinus />
                        </Button>
                        <span className="px-3 text-lg font-semibold min-w-[3rem] text-center">
                          {item.quantity}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        >
                          <FiPlus />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeFromCart(item.id)}
                          className="ml-2"
                        >
                          <FiTrash2 className="mr-1" /> Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Cart Summary */}
          <Card className="rounded-xl shadow-lg border-2 border-indigo-200">
            <CardContent className="p-6">
              <div className="space-y-4">
                {Object.entries(groupedByVendor).map(([vendorId, group]) => (
                  <div
                    key={vendorId}
                    className="flex justify-between items-center text-sm"
                  >
                    <span className="text-gray-600">
                      {group.vendor?.name || "Vendor"} ({group.items.length} {group.items.length === 1 ? "item" : "items"})
                    </span>
                    <span className="font-semibold">
                      ₦{group.subtotal.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
                <div className="border-t pt-4 flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-gray-900">Total</h2>
                  <span className="text-3xl font-bold text-indigo-600">
                    ₦{total.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="flex justify-center mt-6">
                <Button
                  className="rounded-full px-8 py-6 bg-green-600 text-white font-bold text-lg shadow-lg hover:bg-green-700"
                  onClick={handleCheckout}
                  size="lg"
                >
                  <ShoppingBag className="h-5 w-5 mr-2" />
                  Checkout ({Object.keys(groupedByVendor).length} {Object.keys(groupedByVendor).length === 1 ? "vendor" : "vendors"})
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        </>
      )}
    </section>
  );
}
