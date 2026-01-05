"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, Package } from "lucide-react";

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const [verifying, setVerifying] = useState(true);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let redirectTimer: NodeJS.Timeout | null = null;
    
    const verifyPayment = async () => {
      try {
        // Get reference from URL or sessionStorage
        const reference = searchParams.get("reference") || 
          (typeof window !== "undefined" ? sessionStorage.getItem("paymentReference") : null);

        if (!reference) {
          setError("Payment reference not found");
          setVerifying(false);
          return;
        }

        // Get pending orders and delivery details from sessionStorage if available
        let pendingOrders = null;
        let deliveryDetails = null;
        if (typeof window !== "undefined") {
          const pendingOrdersStr = sessionStorage.getItem("pendingOrdersData");
          if (pendingOrdersStr) {
            try {
              pendingOrders = JSON.parse(pendingOrdersStr);
              console.log("📦 Found pending orders:", pendingOrders.length);
            } catch (parseError) {
              console.error("Error parsing pending orders:", parseError);
            }
          }
          
          const deliveryDetailsStr = sessionStorage.getItem("deliveryDetails");
          if (deliveryDetailsStr) {
            try {
              deliveryDetails = JSON.parse(deliveryDetailsStr);
              console.log("📦 Found delivery details:", deliveryDetails);
            } catch (parseError) {
              console.error("Error parsing delivery details:", parseError);
            }
          }
        }

        // Verify payment with Paystack (with timeout)
        const verifyPromise = fetch("/api/payment/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            reference,
            pending_orders: pendingOrders,
            delivery_details: deliveryDetails,
          }),
        });

        // Add timeout to prevent endless loading
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("Payment verification timeout. Please check your orders page.")), 10000)
        );

        const verifyResponse = await Promise.race([verifyPromise, timeoutPromise]);
        const verifyData = await verifyResponse.json();

        if (!verifyResponse.ok || !verifyData.success) {
          setError(verifyData.error || "Payment verification failed");
          setVerifying(false);
          return;
        }

        // Clear sessionStorage after successful verification
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("pendingOrdersData");
          sessionStorage.removeItem("paymentId");
          sessionStorage.removeItem("paymentAmount");
          sessionStorage.removeItem("paymentReference");
          sessionStorage.removeItem("deliveryDetails");
        }

        setPaymentData(verifyData);
        setPaymentVerified(true);
        setVerifying(false);
        
        // Auto-redirect to orders page after 5 seconds (give user time to see success message)
        // Use window.location.href instead of router.push to avoid Next.js clientReferenceManifest error
        // Add a small delay to ensure the component has fully rendered before redirecting
        redirectTimer = setTimeout(() => {
          if (typeof window !== "undefined") {
            // Use a full page reload to ensure Next.js properly loads the orders page
            window.location.href = "/orders";
          }
        }, 5000);
      } catch (err: any) {
        console.error("Error verifying payment:", err);
        setError(err.message || "An error occurred while verifying payment");
        setVerifying(false);
      }
    };

    verifyPayment();
    
    // Cleanup function
    return () => {
      if (redirectTimer) {
        clearTimeout(redirectTimer);
      }
    };
  }, [searchParams]);

  if (verifying) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-indigo-600 h-8 w-8 mb-4" />
        <p className="text-gray-600">Verifying your payment...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Payment Verification Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="flex gap-4">
              <Button onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/orders";
                }
              }}>
                View Orders
              </Button>
              <Button variant="outline" onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/explore";
                }
              }}>
                Continue Shopping
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!paymentVerified || !paymentData) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Payment Status Unknown</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              We couldn't verify your payment status. Please check your orders or contact support.
            </p>
            <div className="flex gap-4">
              <Button onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/orders";
                }
              }}>
                View Orders
              </Button>
              <Button variant="outline" onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/explore";
                }
              }}>
                Continue Shopping
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <Card className="border-green-200">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-600" />
          </div>
          <CardTitle className="text-2xl text-green-600">Payment Successful!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-gray-600 mb-2">Your payment has been processed successfully.</p>
            <p className="text-sm text-gray-500">
              Reference: {paymentData.reference}
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Amount Paid:</span>
              <span className="font-semibold">
                ₦{Number(paymentData.amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
              </span>
            </div>
            {paymentData.commission && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Platform Commission (10%):</span>
                <span>
                  ₦{Number(paymentData.commission || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-gray-600 mb-2">
              ✅ Your order has been placed successfully!
            </p>
            {paymentData.orders_created !== undefined && (
              <p className="text-sm text-green-600 font-semibold mb-2">
                {paymentData.orders_created > 0 
                  ? `✅ ${paymentData.orders_created} order(s) created and sent to vendors`
                  : "⚠️ Orders are being processed"}
              </p>
            )}
            <p className="text-sm text-gray-500">
              The vendor will be notified and can accept or decline your order. You'll be redirected to your orders page in a moment...
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <Button 
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/orders";
                }
              }}
              className="flex-1"
            >
              <Package className="h-4 w-4 mr-2" />
              View Orders Now
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/explore";
                }
              }}
              className="flex-1"
            >
              Continue Shopping
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
