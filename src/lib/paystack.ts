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
async function processPaymentSuccess(
  response: { reference: string; status: string },
  paymentId: string | undefined,
  amount: number,
  ordersToUpdate: string[]
): Promise<void> {
  try {
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error("User not authenticated");
      alert("Authentication error. Please try again.");
      return;
    }

    // CRITICAL: Create orders FIRST, then update payment status
    // This ensures the payout trigger can find orders when payment status changes to 'success'
    let createdOrderIds: string[] = [];
    
    if (typeof window !== "undefined") {
      const pendingOrdersDataStr = sessionStorage.getItem("pendingOrdersData");
      
      if (pendingOrdersDataStr) {
        try {
          const ordersToInsert = JSON.parse(pendingOrdersDataStr);
          
          // Add payment_reference to all orders before inserting
          const ordersWithPaymentRef = ordersToInsert.map((order: any) => ({
            ...order,
            payment_reference: response.reference,
          }));

          console.log("🔄 Creating orders with payment reference:", response.reference);

          // Insert all orders with payment reference FIRST
          const { data: ordersData, error: ordersInsertError } = await supabase
            .from("orders")
            .insert(ordersWithPaymentRef)
            .select();

          if (ordersInsertError) {
            console.error("Error creating orders:", ordersInsertError);
            alert("Payment successful, but there was an error creating orders. Please contact support.");
            return;
          }

          if (ordersData && ordersData.length > 0) {
            createdOrderIds = ordersData.map((order: any) => order.id);
            console.log("✅ Created orders:", createdOrderIds);
            
            // Update orders to "Paid" status (payment_reference already set during insert)
            const { error: ordersUpdateError } = await supabase
              .from("orders")
              .update({
                status: "Paid",
              })
              .in("id", createdOrderIds);

            if (ordersUpdateError) {
              console.error("Error updating orders:", ordersUpdateError);
              alert("Payment successful, but there was an error updating orders. Please contact support.");
              return;
            }
          }
        } catch (error: any) {
          console.error("Error parsing order data:", error);
          alert("Payment successful, but there was an error processing orders. Please contact support.");
          return;
        }
      } else if (ordersToUpdate.length > 0) {
        // Legacy: Update existing orders (for backward compatibility)
        const { error: ordersUpdateError } = await supabase
          .from("orders")
          .update({
            status: "Paid",
            payment_reference: response.reference,
          })
          .in("id", ordersToUpdate);

        if (ordersUpdateError) {
          console.error("Error updating orders:", ordersUpdateError);
          alert("Payment successful, but there was an error updating orders. Please contact support.");
          return;
        }
        
        createdOrderIds = ordersToUpdate;
      }
    }

    // NOW update payment status to 'success' - this will trigger payout creation
    // The trigger will find the orders we just created via payment_reference
    if (paymentId) {
      console.log("🔄 Updating payment status to 'success' - this will trigger payout creation");
      const { error: paymentUpdateError } = await supabase
        .from("payments")
        .update({
          status: "success",
          payment_reference: response.reference,
        })
        .eq("id", paymentId);

      if (paymentUpdateError) {
        console.error("Error updating payment record:", paymentUpdateError);
        alert("Payment successful, but there was an error updating payment record. Please contact support.");
        return;
      }
      console.log("✅ Payment status updated to 'success' - payout trigger should have fired");
    } else {
      // Create new payment record if paymentId doesn't exist (fallback case)
      // Calculate tax and commission from amount (assuming amount includes tax)
      // If amount = subtotal + tax, and tax = 7.5% of subtotal, then:
      // amount = subtotal * 1.075, so subtotal = amount / 1.075
      const calculatedSubtotal = amount / 1.075;
      const calculatedTax = amount - calculatedSubtotal;
      const calculatedCommission = calculatedSubtotal * 0.10;
      
      console.log("🔄 Creating payment record (fallback) with calculated values");
      const { data: newPaymentData, error: paymentInsertError } = await supabase
        .from("payments")
        .insert([
          {
            user_id: user.id,
            subtotal: Math.round(calculatedSubtotal * 100) / 100,
            tax_amount: Math.round(calculatedTax * 100) / 100,
            commission_amount: Math.round(calculatedCommission * 100) / 100,
            total_amount: amount,
            status: "success",
            payment_reference: response.reference,
          },
        ])
        .select()
        .single();

      if (paymentInsertError) {
        console.error("Error creating payment record:", paymentInsertError);
        alert("Payment successful, but there was an error creating payment record. Please contact support.");
        return;
      }
      
      console.log("✅ Payment record created - payout trigger should have fired");
    }

    // Clear cart after successful payment
    const { error: cartClearError } = await supabase
      .from("cart_items")
      .delete()
      .eq("user_id", user.id);

    if (cartClearError) {
      console.error("Error clearing cart:", cartClearError);
    }

    // Store payment info in sessionStorage for success page
    if (typeof window !== "undefined") {
      sessionStorage.setItem("paymentReference", response.reference);
      sessionStorage.setItem("paymentAmount", amount.toString());
      sessionStorage.setItem("paidOrderIds", JSON.stringify(createdOrderIds));
      // Clean up pending orders data
      sessionStorage.removeItem("pendingOrdersData");
    }

    // Redirect to payment success page
    if (typeof window !== "undefined") {
      window.location.href = "/payment-success";
    }
  } catch (error: any) {
    console.error("Error processing payment:", error);
    alert("Payment successful, but there was an error processing your order. Please contact support.");
  }
}

export const initiatePaystackPayment = async ({
  amount,
  userEmail,
  orderIds,
  paymentId,
  orderId, // Legacy support, use orderIds instead
}: {
  amount: number;
  userEmail: string;
  orderIds?: string[]; // Array of order IDs for multi-order payments
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
    const PaystackPop = (window as any).PaystackPop;

    if (!PaystackPop || typeof PaystackPop.setup !== "function") {
      throw new Error("PaystackPop.setup is not a function. Paystack may not be loaded correctly. Please refresh the page and try again.");
    }

    // Use orderIds if provided, otherwise fall back to orderId (legacy)
    const ordersToUpdate = orderIds || (orderId ? [String(orderId)] : []);
    
    // Generate payment reference
    const paymentReference = paymentId 
      ? `payment_${paymentId}_${Date.now()}`
      : `order_${ordersToUpdate[0] || "payment"}_${Date.now()}`;

    // CRITICAL: Paystack callback must be a synchronous function
    // Store parameters in variables accessible to callback closure
    const callbackPaymentId = paymentId;
    const callbackAmount = amount;
    const callbackOrdersToUpdate = ordersToUpdate;

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
        processPaymentSuccess(response, callbackPaymentId, callbackAmount, callbackOrdersToUpdate).catch((error) => {
          console.error("Error in processPaymentSuccess:", error);
          alert("Payment successful, but there was an error processing your order. Please contact support.");
        });
      },
      onClose: function() {
        console.log("Payment popup closed by user");
        // Update payment status to cancelled if payment was not completed
        if (callbackPaymentId) {
          supabase
            .from("payments")
            .update({
              status: "cancelled",
            })
            .eq("id", callbackPaymentId)
            .eq("status", "pending") // Only update if still pending
            .catch((error) => {
              console.error("Error updating payment status to cancelled:", error);
            });
        }
      },
    });

    // Validate payment handler
    if (!paymentHandler || typeof paymentHandler.openIframe !== "function") {
      throw new Error("Unable to open Paystack payment window. paymentHandler.openIframe is not a function");
    }

    // Open the Paystack payment popup
    paymentHandler.openIframe();
  } catch (error: any) {
    console.error("Error in initiatePaystackPayment:", error);
    alert(`Payment error: ${error.message || "Failed to initiate payment. Please try again."}`);
    throw error;
  }
};
