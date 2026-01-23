import { supabase } from "@/lib/supabaseClient";

// Extend Window interface to include PaystackPop
declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: {
        key: string;
        email: string;
        amount: number;
        currency?: string;
        ref?: string;
        callback: (response: { reference: string; status: string; transaction?: string }) => void;
        onClose?: () => void;
      }) => {
        openIframe: () => void;
      };
    };
  }
}

export const loadPaystackScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Window is not defined"));
      return;
    }

    // Check if PaystackPop is already loaded
    if (window.PaystackPop && typeof window.PaystackPop.setup === "function") {
      resolve();
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]');
    if (existingScript) {
      // Script is loading or loaded, wait for it
      const checkInterval = setInterval(() => {
        if (window.PaystackPop && typeof window.PaystackPop.setup === "function") {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(checkInterval);
        if (window.PaystackPop && typeof window.PaystackPop.setup === "function") {
          resolve();
        } else {
          reject(new Error("PaystackPop failed to initialize"));
        }
      }, 5000);
      return;
    }

    // Create and load script
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;

    script.onload = () => {
      // Wait for PaystackPop to be available
      const checkPaystackPop = setInterval(() => {
        if (window.PaystackPop && typeof window.PaystackPop.setup === "function") {
          clearInterval(checkPaystackPop);
          resolve();
        }
      }, 50);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkPaystackPop);
        if (window.PaystackPop && typeof window.PaystackPop.setup === "function") {
          resolve();
        } else {
          reject(new Error("PaystackPop failed to initialize after script load"));
        }
      }, 5000);
    };

    script.onerror = () => {
      reject(new Error("Failed to load Paystack script"));
    };

    document.body.appendChild(script);
  });
};

export const getAuthenticatedUserEmail = async (): Promise<string | null> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.email || null;
};

// Process payment success asynchronously
// CRITICAL: This function should NOT create orders directly - let the API handle it
// This prevents schema errors and duplicate order creation
async function processPaymentSuccess(
  response: { reference: string; status: string },
  paymentId: string | undefined,
  amount: number
): Promise<void> {
  try {
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error("User not authenticated");
      // Still redirect - payment is successful
      if (typeof window !== "undefined") {
        window.location.href = "/payment-success?reference=" + encodeURIComponent(response.reference);
      }
      return;
    }

    // CRITICAL: Do NOT create orders here - let the payment-success page handle it via API
    // This prevents:
    // 1. Schema errors from blocking redirect
    // 2. Duplicate order creation
    // 3. Unhandled exceptions crashing the UI
    
    // Only update payment status if paymentId exists (non-blocking)
    if (paymentId) {
      try {
        console.log("🔄 Updating payment status to 'success'");
        const { error: paymentUpdateError } = await supabase
          .from("payments")
          .update({
            status: "success",
            payment_reference: response.reference,
          })
          .eq("id", paymentId);

        if (paymentUpdateError) {
          console.error("⚠️ Error updating payment record (non-critical):", paymentUpdateError);
          // Don't block redirect - payment is successful
        } else {
          console.log("✅ Payment status updated to 'success'");
        }
      } catch (updateError) {
        console.error("⚠️ Exception updating payment (non-critical):", updateError);
        // Don't block redirect
      }
    }

    // Clear cart (non-blocking, fire and forget)
    try {
      await supabase
        .from("cart_items")
        .delete()
        .eq("user_id", user.id);
    } catch (cartError) {
      console.error("⚠️ Error clearing cart (non-critical):", cartError);
      // Don't block redirect
    }

    // Store payment info in sessionStorage for success page
    // This allows the payment-success page to verify and create orders via API
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("paymentReference", response.reference);
        sessionStorage.setItem("paymentAmount", amount.toString());
        // Keep pendingOrdersData - let payment-success page handle order creation
        // Don't remove it here to avoid race conditions
      } catch (storageError) {
        console.error("⚠️ Error storing payment info (non-critical):", storageError);
        // Don't block redirect
      }
    }

    // Fire-and-forget backend verification (do not block redirect)
    try {
      const serviceRequestId = typeof window !== "undefined"
        ? sessionStorage.getItem("serviceRequestId")
        : null;
      void fetch("/api/paystack/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reference: response.reference,
          service_request_id: serviceRequestId,
        }),
      });
    } catch (verifyError) {
      console.error("⚠️ Error triggering Paystack verification (non-critical):", verifyError);
    }

    // CRITICAL: Always redirect, even if errors occurred
    // Payment is successful - order creation can happen on the success page
    if (typeof window !== "undefined") {
      console.log("✅ Payment successful - redirecting to success page");
      // Use full page reload to ensure clean state
      window.location.href = "/payment-success?reference=" + encodeURIComponent(response.reference);
    }
  } catch (error) {
    // CRITICAL: Even if everything fails, redirect to success page
    // Payment is successful - don't block user from seeing success
    console.error("❌ Error in processPaymentSuccess:", error);
    
    // Store reference for success page
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("paymentReference", response.reference);
      } catch {
        // Ignore storage errors
      }
      // Always redirect - payment is successful
      window.location.href = "/payment-success?reference=" + encodeURIComponent(response.reference);
    }
  }
}

export const initiatePaystackPayment = async ({
  amount,
  userEmail,
  paymentId,
  orderId, // Legacy support, use orderIds instead
}: {
  amount: number;
  userEmail: string;
  paymentId?: string; // Payment record ID from payments table
  orderId?: string | number; // Legacy single order ID (for backward compatibility)
}): Promise<void> => {
  try {
    // Validate Paystack public key first
    const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!publicKey) {
      throw new Error("Paystack public key is not configured. Please contact support.");
    }

    // Load Paystack script and ensure it's available
    await loadPaystackScript();

    // Access PaystackPop directly from window (like vendor page does)
    interface WindowWithPaystack extends Window {
      PaystackPop?: {
        setup: (options: unknown) => { openIframe: () => void };
      };
    }
    const PaystackPop = (window as WindowWithPaystack).PaystackPop;

    if (!PaystackPop || typeof PaystackPop.setup !== "function") {
      throw new Error("PaystackPop.setup is not a function. Paystack may not be loaded correctly. Please refresh the page and try again.");
    }

    // Generate payment reference
    const paymentReference = paymentId 
      ? `payment_${paymentId}_${Date.now()}`
      : `order_${orderId ? String(orderId) : "payment"}_${Date.now()}`;

    // CRITICAL: Paystack callback must be a synchronous function
    // Store parameters in variables accessible to callback closure
    const callbackPaymentId = paymentId;
    const callbackAmount = amount;

    // Setup Paystack payment - define callbacks inline as regular functions
    // Using function expressions (not arrow functions) to ensure proper 'this' binding
    const paymentHandler = PaystackPop.setup({
      key: publicKey,
      email: userEmail,
      amount: amount * 100, // Convert to kobo (smallest currency unit)
      currency: "NGN",
      ref: paymentReference,
      callback: function(response: { reference: string; status: string; transaction?: string }) {
        console.log("Payment callback triggered:", response);
        // Process payment asynchronously (fire and forget with error handling)
        processPaymentSuccess(response, callbackPaymentId, callbackAmount).catch((error) => {
          console.error("Error in processPaymentSuccess:", error);
          alert("Payment successful, but there was an error processing your order. Please contact support.");
        });
      },
      onClose: function() {
        console.log("Payment popup closed by user");
        // Update payment status to cancelled if payment was not completed
        if (callbackPaymentId) {
          void (async () => {
            const { error } = await supabase
              .from("payments")
              .update({
                status: "cancelled",
              })
              .eq("id", callbackPaymentId)
              .eq("status", "pending"); // Only update if still pending

            if (error) {
              console.error("Error updating payment status to cancelled:", error);
            }
          })();
        }
      },
    });

    // Validate payment handler
    if (!paymentHandler || typeof paymentHandler.openIframe !== "function") {
      throw new Error("Unable to open Paystack payment window. paymentHandler.openIframe is not a function");
    }

    // Open the Paystack payment popup
    paymentHandler.openIframe();
  } catch (error) {
    console.error("Error in initiatePaystackPayment:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to initiate payment. Please try again.";
    alert(`Payment error: ${errorMessage}`);
    throw error;
  }
};
