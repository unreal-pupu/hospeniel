import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface PaymentAuditLogInput {
  paystack_reference: string;
  service_request_id?: string | null;
  user_id?: string | null;
  vendor_id?: string | null;
  verification_status: string;
  paystack_response: unknown;
}

interface DeliveryDetailsPayload {
  address?: string;
  delivery_address_line_1?: string;
  city?: string;
  delivery_city?: string;
  state?: string;
  delivery_state?: string;
  delivery_zone?: string;
  zone?: string;
  postal_code?: string;
  delivery_postal_code?: string;
  phone?: string;
  delivery_phone_number?: string;
  delivery_charge?: number;
  special_instructions?: string;
}

async function logPaymentAuditEntry(entry: PaymentAuditLogInput) {
  try {
    const { error } = await supabaseAdmin
      .from("payment_audit_logs")
      .insert({
        paystack_reference: entry.paystack_reference,
        service_request_id: entry.service_request_id ?? null,
        user_id: entry.user_id ?? null,
        vendor_id: entry.vendor_id ?? null,
        verification_status: entry.verification_status,
        paystack_response: entry.paystack_response,
      });

    if (error) {
      console.error("❌ Failed to write payment audit log:", error);
    }
  } catch (auditError) {
    console.error("❌ Exception writing payment audit log:", auditError);
  }
}

export async function POST(req: Request) {
  let requestBody: unknown = null;
  try {
    requestBody = await req.json();
    const { reference, pending_orders, delivery_details, service_request_id } = requestBody as {
      reference?: string;
      pending_orders?: unknown;
      delivery_details?: unknown;
      service_request_id?: string | null;
    };

    let resolvedPendingOrders: unknown = pending_orders;
    let resolvedDeliveryDetails: unknown = delivery_details;

    if (!reference) {
      return NextResponse.json(
        { error: "Payment reference is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(resolvedPendingOrders) || resolvedPendingOrders.length === 0) {
      const { data: paymentPayload, error: paymentPayloadError } = await supabaseAdmin
        .from("payments")
        .select("pending_orders, delivery_details")
        .eq("payment_reference", reference)
        .maybeSingle();

      if (paymentPayloadError) {
        console.error("⚠️ Failed to load payment payload for orders:", paymentPayloadError);
      } else {
        if (Array.isArray(paymentPayload?.pending_orders) && paymentPayload.pending_orders.length > 0) {
          resolvedPendingOrders = paymentPayload.pending_orders;
        }
        if (!resolvedDeliveryDetails && paymentPayload?.delivery_details) {
          resolvedDeliveryDetails = paymentPayload.delivery_details;
        }
      }
    }

    // Extract delivery details and charge
    const deliveryDetails = typeof resolvedDeliveryDetails === "object" && resolvedDeliveryDetails !== null
      ? (resolvedDeliveryDetails as DeliveryDetailsPayload)
      : undefined;
    const deliveryAddress = deliveryDetails?.address || deliveryDetails?.delivery_address_line_1 || "";
    const deliveryCity = deliveryDetails?.city || deliveryDetails?.delivery_city || "";
    const deliveryState = deliveryDetails?.state || deliveryDetails?.delivery_state || "";
    const deliveryZone = deliveryDetails?.delivery_zone || deliveryDetails?.zone || "";
    const deliveryPostalCode = deliveryDetails?.postal_code || deliveryDetails?.delivery_postal_code || "";
    const deliveryPhone = deliveryDetails?.phone || deliveryDetails?.delivery_phone_number || "";
    const deliveryCharge = deliveryDetails?.delivery_charge || 0;

    console.log("🔔 Paystack verify request received:", {
      reference,
      service_request_id,
      has_pending_orders: Array.isArray(resolvedPendingOrders) && resolvedPendingOrders.length > 0,
    });

    await logPaymentAuditEntry({
      paystack_reference: reference,
      service_request_id: service_request_id ?? null,
      verification_status: "request_received",
      paystack_response: {
        reference,
        service_request_id,
        has_pending_orders: Array.isArray(resolvedPendingOrders) && resolvedPendingOrders.length > 0,
      },
    });

    // Verify payment with Paystack
    const trimmedKey = paystackSecretKey.trim();
    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${trimmedKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const verifyData = await verifyResponse.json();

    if (!verifyResponse.ok || !verifyData.status || verifyData.data.status !== "success") {
      await logPaymentAuditEntry({
        paystack_reference: reference,
        service_request_id: service_request_id ?? null,
        verification_status: "verify_failed",
        paystack_response: verifyData,
      });
      return NextResponse.json(
        { 
          success: false,
          error: verifyData.message || "Payment verification failed",
          details: verifyData,
        },
        { status: verifyResponse.status || 400 }
      );
    }

    const transactionData = verifyData.data;

    await logPaymentAuditEntry({
      paystack_reference: reference,
      verification_status: "verified_response",
      paystack_response: verifyData,
    });

  // Lightweight payout validation (non-blocking)
  try {
    const grossAmountKobo = Number(transactionData?.amount || 0);
    const paystackFeeKobo = Number(transactionData?.fees || 0);
    const grossAmount = grossAmountKobo / 100;
    const orderId =
      typeof transactionData?.metadata?.order_id === "string"
        ? transactionData.metadata.order_id
        : null;
    const foodAmount = Number(transactionData?.metadata?.food_amount || 0);
    const deliveryFee = Number(transactionData?.metadata?.delivery_fee || 0);
    const vatAmount = Number(transactionData?.metadata?.vat_amount || 0);
    const expectedVendorPayout = foodAmount * 0.9;
    const expectedPlatformShare = foodAmount * 0.1 + deliveryFee + vatAmount;
    const expectedPlatformPayout = expectedPlatformShare - paystackFeeKobo / 100;
    const expectedGrossTotal = foodAmount + deliveryFee + vatAmount;
    const hasMismatch = Math.abs(expectedGrossTotal - grossAmount) > 0.01;

    await logPaymentAuditEntry({
      paystack_reference: reference,
      service_request_id: service_request_id ?? null,
      vendor_id:
        typeof transactionData?.metadata?.vendor_id === "string"
          ? transactionData.metadata.vendor_id
          : null,
      verification_status: "payout_validation",
      paystack_response: {
        order_id: orderId,
        gross_amount: grossAmount,
        food_amount: foodAmount,
        delivery_fee: deliveryFee,
        vat_amount: vatAmount,
        vendor_payout: expectedVendorPayout,
        platform_payout: expectedPlatformPayout,
        paystack_fee: paystackFeeKobo / 100,
        has_mismatch: hasMismatch,
      },
    });
  } catch (auditError) {
    console.error("⚠️ Payout validation log failed (non-blocking):", auditError);
  }

    // Update payment record in database
    const { data: paymentData, error: paymentError } = await supabaseAdmin
      .from("payments")
      .update({
        status: "success",
        payment_reference: reference,
      })
      .eq("payment_reference", reference)
      .select()
      .single();

    // If payment record not found by reference, try to find by payment_id in metadata
    let paymentRecord = paymentData;
    if (paymentError && transactionData.metadata?.payment_id) {
      const { data: paymentById } = await supabaseAdmin
        .from("payments")
        .update({
          status: "success",
          payment_reference: reference,
        })
        .eq("id", transactionData.metadata.payment_id)
        .select()
        .single();
      
      paymentRecord = paymentById;
    }

    // Create orders if pending_orders data is provided
    let createdOrdersCount = 0;
    interface CreatedOrder {
      id: string;
      vendor_id: string;
      user_id: string;
      product_id: string;
      quantity: number;
      total_price: number;
      [key: string]: unknown;
    }
    let createdOrders: CreatedOrder[] = [];
    let vendorsNotified = false;

    const notifyVendorsForOrders = async (ordersToNotify: CreatedOrder[]) => {
      if (!ordersToNotify || ordersToNotify.length === 0) {
        return;
      }

      const vendorIds = [...new Set(ordersToNotify.map((o) => o.vendor_id))];
      console.log(`📬 Creating notifications for ${vendorIds.length} vendor(s) for ${ordersToNotify.length} order(s)...`);

      for (const vendorId of vendorIds) {
        const vendorOrders = ordersToNotify.filter((o) => o.vendor_id === vendorId);
        const orderCount = vendorOrders.length;

        let customerName = "a customer";
        if (vendorOrders[0]?.user_id) {
          const { data: customerProfile } = await supabaseAdmin
            .from("profiles")
            .select("name, email")
            .eq("id", vendorOrders[0].user_id)
            .single();

          if (customerProfile) {
            customerName = customerProfile.name || customerProfile.email || "a customer";
          }
        }

        const notificationData = {
          vendor_id: vendorId,
          type: "new_order",
          title: "New Order Received",
          message: orderCount === 1
            ? `Order #${vendorOrders[0].id.substring(0, 8)} from ${customerName} has been placed and paid`
            : `You have ${orderCount} new order(s) from ${customerName} waiting for your response!`,
          read: false,
          metadata: {
            type: "new_order",
            order_count: orderCount,
            order_ids: vendorOrders.map(o => o.id),
            customer_name: customerName,
          },
        };

        const { data: notification, error: notifError } = await supabaseAdmin
          .from("notifications")
          .insert(notificationData)
          .select()
          .single();

        if (notifError) {
          console.error(`❌ CRITICAL: Failed to create notification for vendor ${vendorId}:`, {
            error: notifError.message,
            code: notifError.code,
            details: notifError.details,
            hint: notifError.hint,
            notificationData,
          });
        } else {
          console.log(`✅ Notification created successfully for vendor ${vendorId} (notification_id: ${notification?.id})`);
        }
      }

      vendorsNotified = true;
      console.log(`📬 Notification creation complete for ${vendorIds.length} vendor(s)`);
    };
    
    interface PendingOrder {
      vendor_id?: string;
      user_id?: string;
      product_id?: string;
      quantity?: number;
      total_price?: number;
      delivery_address_line_1?: string;
      delivery_city?: string;
      delivery_state?: string;
      delivery_postal_code?: string;
      delivery_phone_number?: string;
      [key: string]: unknown;
    }
    
    if (resolvedPendingOrders && Array.isArray(resolvedPendingOrders) && resolvedPendingOrders.length > 0) {
      console.log(`🔄 Processing ${resolvedPendingOrders.length} pending order(s)...`);
      const pendingOrdersArray = resolvedPendingOrders as PendingOrder[];
      const totalFoodAmount = pendingOrdersArray.reduce(
        (sum, order) => sum + (Number(order.total_price) || 0),
        0
      );
      const vatTotal = Number(transactionData?.metadata?.vat_amount || 0);
      
      // Validate and prepare orders with all required fields
      const ordersWithRef = pendingOrdersArray
        .filter((order) => {
          // Filter out invalid orders instead of throwing
          if (!order.vendor_id) {
            console.error("❌ Order missing vendor_id, skipping:", order);
            return false;
          }
          if (!order.user_id) {
            console.error("❌ Order missing user_id, skipping:", order);
            return false;
          }
          if (!order.product_id) {
            console.error("❌ Order missing product_id, skipping:", order);
            return false;
          }
          return true;
        })
        .map((order) => {
          // Runtime type guards to ensure required fields are strings
          // These checks are necessary even after filter because TypeScript doesn't narrow types across filter
          if (!order.user_id || typeof order.user_id !== "string") {
            throw new Error(`Invalid user_id for order: ${JSON.stringify(order)}`);
          }
          if (!order.vendor_id || typeof order.vendor_id !== "string") {
            throw new Error(`Invalid vendor_id for order: ${JSON.stringify(order)}`);
          }
          if (!order.product_id || typeof order.product_id !== "string") {
            throw new Error(`Invalid product_id for order: ${JSON.stringify(order)}`);
          }

          // Use extracted delivery details
          const orderTotalPrice = Number(order.total_price) || 0;
          const vatShare = totalFoodAmount > 0
            ? (orderTotalPrice / totalFoodAmount) * vatTotal
            : 0;

          const preparedOrder: {
            user_id: string;
            vendor_id: string;
            product_id: string;
            quantity: number;
            total_price: number;
            vat_amount?: number;
            delivery_address?: string;
            delivery_city?: string;
            delivery_state?: string;
            delivery_zone?: string;
            delivery_postal_code?: string;
            delivery_phone?: string;
            special_instructions?: string;
            payment_reference: string;
            status: string;
            [key: string]: unknown;
          } = {
            user_id: order.user_id,
            vendor_id: order.vendor_id, // This should be the vendor's auth.users.id
            product_id: order.product_id,
            quantity: order.quantity || 1,
            total_price: orderTotalPrice,
            payment_reference: reference,
            status: "Pending", // Set to Pending so vendor can see and accept it
          };

          // Add delivery address fields only if they have values
          // Map to correct column names in orders table
          if (deliveryAddress) {
            preparedOrder.delivery_address = deliveryAddress;
          }
          if (deliveryCity) {
            preparedOrder.delivery_city = deliveryCity;
          }
          if (deliveryState) {
            preparedOrder.delivery_state = deliveryState;
          }
          if (deliveryZone) {
            preparedOrder.delivery_zone = deliveryZone;
          }
          if (deliveryPostalCode) {
            preparedOrder.delivery_postal_code = deliveryPostalCode;
          }
          if (deliveryPhone) {
            preparedOrder.delivery_phone = deliveryPhone;
          }
          if (deliveryCharge && deliveryCharge > 0) {
            preparedOrder.delivery_charge = deliveryCharge;
          }
          if (vatShare > 0) {
            preparedOrder.vat_amount = Math.round(vatShare * 100) / 100;
          }
          // Add special instructions if provided
          if (deliveryDetails?.special_instructions) {
            preparedOrder.special_instructions = deliveryDetails.special_instructions;
          }

          console.log("📦 Preparing order for insertion:", {
            vendor_id: preparedOrder.vendor_id,
            user_id: preparedOrder.user_id,
            product_id: preparedOrder.product_id,
            total_price: preparedOrder.total_price,
            reference: preparedOrder.payment_reference,
            delivery_charge: preparedOrder.delivery_charge || 0,
          });

          return preparedOrder;
        });

      if (ordersWithRef.length === 0) {
        console.warn("⚠️ No valid orders to create after filtering");
      } else {
        console.log(`🔄 Creating ${ordersWithRef.length} order(s) with payment reference: ${reference}`);
        
        // Check if orders with this reference already exist to avoid duplicates
        const { data: existingOrders } = await supabaseAdmin
          .from("orders")
          .select("id")
          .eq("payment_reference", reference);

        if (existingOrders && existingOrders.length > 0) {
          console.log(`⚠️ Orders with reference ${reference} already exist. Skipping creation.`);
          createdOrdersCount = existingOrders.length;
          
          // Fetch existing orders to create notifications (select all fields required by CreatedOrder)
          const { data: existingOrdersFull } = await supabaseAdmin
            .from("orders")
            .select("id, vendor_id, user_id, product_id, quantity, total_price")
            .eq("payment_reference", reference);
          
          if (existingOrdersFull) {
            // Map to ensure all required fields are present and properly typed
            createdOrders = existingOrdersFull.map((order) => ({
              id: order.id,
              vendor_id: order.vendor_id,
              user_id: order.user_id,
              product_id: order.product_id,
              quantity: order.quantity || 1,
              total_price: order.total_price || 0,
            }));
          }
        } else {
          // Try to insert orders, but handle schema errors gracefully
          const { data: insertedOrders, error: ordersError } = await supabaseAdmin
            .from("orders")
            .insert(ordersWithRef)
            .select();

          if (ordersError) {
            console.error("❌ CRITICAL: Error creating orders:", ordersError);
            console.error("❌ Orders data that failed:", JSON.stringify(ordersWithRef, null, 2));
            console.error("❌ Error details:", {
              code: ordersError.code,
              message: ordersError.message,
              details: ordersError.details,
              hint: ordersError.hint,
            });

            if (ordersError.code === "23505") {
              console.warn("⚠️ Duplicate orders detected for this payment. Using existing orders.");
              const { data: existingOrdersFull } = await supabaseAdmin
                .from("orders")
                .select("id, vendor_id, user_id, product_id, quantity, total_price")
                .eq("payment_reference", reference);
              if (existingOrdersFull) {
                createdOrders = existingOrdersFull.map((order) => ({
                  id: order.id,
                  vendor_id: order.vendor_id,
                  user_id: order.user_id,
                  product_id: order.product_id,
                  quantity: order.quantity || 1,
                  total_price: order.total_price || 0,
                }));
                createdOrdersCount = createdOrders.length;
              }
            }
            
            // If error is PGRST204 (column not found), try without problematic columns
            if (ordersError.code === "PGRST204" || ordersError.message?.includes("column") || ordersError.message?.includes("does not exist")) {
              console.warn("⚠️ Schema mismatch detected. Attempting to insert without optional delivery fields...");
              
              // Remove optional fields that might not exist (schema cache lag)
              const ordersWithoutOptionalFields = ordersWithRef.map(order => {
                const rest = { ...order };
                delete rest.delivery_zone;
                delete rest.special_instructions;
                delete rest.delivery_postal_code;
                delete rest.vat_amount;
                return rest;
              });
              
              const { data: retryOrders, error: retryError } = await supabaseAdmin
                .from("orders")
                .insert(ordersWithoutOptionalFields)
                .select();
              
              if (retryError) {
                console.error("❌ Retry also failed:", retryError);
                // Payment is successful, but orders couldn't be created
                // This is a critical issue that needs admin attention
                if (retryError.code === "23505") {
                  console.warn("⚠️ Duplicate orders detected on retry. Using existing orders.");
                  const { data: existingOrdersFull } = await supabaseAdmin
                    .from("orders")
                    .select("id, vendor_id, user_id, product_id, quantity, total_price")
                    .eq("payment_reference", reference);
                  if (existingOrdersFull) {
                    createdOrders = existingOrdersFull.map((order) => ({
                      id: order.id,
                      vendor_id: order.vendor_id,
                      user_id: order.user_id,
                      product_id: order.product_id,
                      quantity: order.quantity || 1,
                      total_price: order.total_price || 0,
                    }));
                    createdOrdersCount = createdOrders.length;
                  }
                }
              } else {
                console.log("✅ Orders created after removing optional fields");
                createdOrders = retryOrders || [];
                createdOrdersCount = createdOrders.length;
              }
            } else {
              // Other errors - log but don't retry
              console.error("❌ Non-schema error - cannot retry automatically");
            }
            
            // Continue even if order creation failed - payment is successful
            // Admin should be notified of this issue
          } else {
            createdOrders = insertedOrders || [];
            createdOrdersCount = createdOrders.length;
            console.log(`✅ Successfully created ${createdOrdersCount} order(s)`);
            if (createdOrders.length > 0) {
              console.log("✅ Created order IDs:", createdOrders.map((o) => o.id));
              console.log("✅ Created order vendor_ids:", createdOrders.map((o) => o.vendor_id));
              console.log("✅ Created order statuses:", createdOrders.map((o) => o.status));
            }
          }
        }
        
        await notifyVendorsForOrders(createdOrders);
        if (!vendorsNotified) {
          console.warn("⚠️ No orders were created, so no notifications will be sent");
        }
      }
    } else {
      console.warn("⚠️ No pending_orders provided in payment verification");
    }

    // Update existing orders with payment reference
    if (transactionData.metadata?.order_id) {
      await supabaseAdmin
        .from("orders")
        .update({
          status: "Paid",
          payment_reference: reference,
        })
        .eq("id", transactionData.metadata.order_id);
    }

    // Also update any orders with this payment reference
    await supabaseAdmin
      .from("orders")
      .update({
        status: "Paid",
      })
      .eq("payment_reference", reference)
      .neq("status", "Paid");

    if (!vendorsNotified) {
      const { data: paidOrders } = await supabaseAdmin
        .from("orders")
        .select("id, vendor_id, user_id, product_id, quantity, total_price")
        .eq("payment_reference", reference);

      await notifyVendorsForOrders((paidOrders as CreatedOrder[]) || []);
    }

    const amountPaid = transactionData.amount / 100; // Convert from kobo to Naira

    // Derive service_request_id from Paystack metadata if missing
    const metadataServiceRequestId =
      typeof transactionData?.metadata?.service_request_id === "string"
        ? transactionData.metadata.service_request_id
        : undefined;
    let resolvedServiceRequestId = service_request_id || metadataServiceRequestId;

    // Fallback: match by payment_reference
    if (!resolvedServiceRequestId) {
      const { data: referenceMatch, error: referenceMatchError } = await supabaseAdmin
        .from("service_requests")
        .select("id")
        .eq("payment_reference", reference)
        .maybeSingle();

      if (referenceMatchError) {
        console.error("❌ Failed to match service request by reference:", referenceMatchError);
      } else if (referenceMatch) {
        resolvedServiceRequestId = referenceMatch.id;
      }
    }

    console.log("🔎 Resolved service request lookup:", {
      reference,
      resolvedServiceRequestId,
      metadataServiceRequestId,
    });

    // Handle service request payment
    if (resolvedServiceRequestId) {
      console.log(`🔄 Processing service request payment for request: ${resolvedServiceRequestId}`);

      const { data: existingServiceRequest, error: existingServiceRequestError } = await supabaseAdmin
        .from("service_requests")
        .select("id, vendor_id, user_id, contact_info, payment_status")
        .eq("id", resolvedServiceRequestId)
        .single();

      if (existingServiceRequestError) {
        console.error("❌ Error loading service request before update:", existingServiceRequestError);
      }
      
      await logPaymentAuditEntry({
        paystack_reference: reference,
        service_request_id: resolvedServiceRequestId,
        user_id: existingServiceRequest?.user_id ?? null,
        vendor_id: existingServiceRequest?.vendor_id ?? null,
        verification_status: "before_service_request_update",
        paystack_response: verifyData,
      });

      const updatePayload = {
        status: "Paid",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        payment_reference: reference,
        payment_method: "paystack",
        payment_status: "paid",
        amount_paid: amountPaid,
      };

      const { data: updatedById, error: updateByIdError } = await supabaseAdmin
        .from("service_requests")
        .update(updatePayload)
        .eq("id", resolvedServiceRequestId)
        .select("id, vendor_id, user_id, contact_info, payment_status");

      if (updateByIdError) {
        console.error("❌ Error updating service request by id:", updateByIdError);
      }

      console.log("🧾 Service request update by id result:", {
        reference,
        updated_rows: updatedById?.length || 0,
      });

      let resolvedRequest = updatedById?.[0] || existingServiceRequest || null;

      if (!resolvedRequest) {
        const { data: updatedByReference, error: updateByReferenceError } = await supabaseAdmin
          .from("service_requests")
          .update(updatePayload)
          .eq("payment_reference", reference)
          .select("id, vendor_id, user_id, contact_info, payment_status");

        if (updateByReferenceError) {
          console.error("❌ Error updating service request by reference:", updateByReferenceError);
        } else if (updatedByReference?.[0]) {
          resolvedRequest = updatedByReference[0];
        }

        console.log("🧾 Service request update by reference result:", {
          reference,
          updated_rows: updatedByReference?.length || 0,
        });
      }

      if (!resolvedRequest) {
        await logPaymentAuditEntry({
          paystack_reference: reference,
          service_request_id: resolvedServiceRequestId,
          verification_status: "service_request_update_failed",
          paystack_response: verifyData,
        });
      } else {
        const wasAlreadyPaid = existingServiceRequest?.payment_status === "paid";
        console.log("✅ Service request payment processed successfully");

        await logPaymentAuditEntry({
          paystack_reference: reference,
          service_request_id: resolvedRequest.id,
          user_id: resolvedRequest.user_id ?? null,
          vendor_id: resolvedRequest.vendor_id ?? null,
          verification_status: "after_service_request_update",
          paystack_response: verifyData,
        });
        
        // Get customer name for notification
        let customerName = "a customer";
        if (resolvedRequest?.user_id) {
          const { data: customerProfile } = await supabaseAdmin
            .from("profiles")
            .select("name, email")
            .eq("id", resolvedRequest.user_id)
            .single();
          
          if (customerProfile) {
            customerName = customerProfile.name || customerProfile.email || "a customer";
          }
        }

        // Create a service order record (if not already created)
        if (resolvedRequest.user_id && resolvedRequest.vendor_id) {
          const { data: existingServiceOrder, error: existingServiceOrderError } = await supabaseAdmin
            .from("orders")
            .select("id")
            .eq("service_request_id", resolvedRequest.id)
            .maybeSingle();

          if (existingServiceOrderError) {
            console.error("❌ Failed to check existing service order:", existingServiceOrderError);
          } else if (!existingServiceOrder) {
            const { error: serviceOrderError } = await supabaseAdmin
              .from("orders")
              .insert({
                user_id: resolvedRequest.user_id,
                vendor_id: resolvedRequest.vendor_id,
                product_id: null,
                quantity: 1,
                total_price: amountPaid,
                status: "Paid",
                payment_reference: reference,
                order_type: "service",
                service_request_id: resolvedRequest.id,
              });

            if (serviceOrderError) {
              console.error("❌ Failed to create service order:", serviceOrderError);
            } else {
              console.log("✅ Service order created for service request:", resolvedRequest.id);
            }
          }
        }

        // Create notification for vendor
        const notificationData = {
          vendor_id: resolvedRequest.vendor_id,
          type: "service_request_paid",
          title: "Service Request Payment Received",
          message: `Payment received for service request ${resolvedRequest.id} from ${customerName}. The request is now paid and ready for completion.`,
          read: false,
          metadata: {
            type: "service_request_paid",
            service_request_id: resolvedRequest.id,
            customer_name: customerName,
            payment_reference: reference,
            contact_info: resolvedRequest?.contact_info || null,
          },
        };

        if (!wasAlreadyPaid && notificationData.vendor_id) {
          const { data: existingNotification, error: existingNotifError } = await supabaseAdmin
            .from("notifications")
            .select("id")
            .eq("vendor_id", notificationData.vendor_id)
            .eq("type", "service_request_paid")
            .eq("metadata->>service_request_id", resolvedRequest.id)
            .maybeSingle();

          if (existingNotifError) {
            console.error("❌ Failed to check existing notification:", existingNotifError);
          } else if (!existingNotification) {
            const { data: notification, error: notifError } = await supabaseAdmin
              .from("notifications")
              .insert(notificationData)
              .select()
              .single();

            if (notifError) {
              console.error(`❌ Failed to create notification for vendor ${notificationData.vendor_id}:`, notifError);
            } else {
              console.log(`✅ Notification created successfully for vendor ${notificationData.vendor_id} (notification_id: ${notification?.id})`);
            }
          }
        }

        // Insert system message into service_request_messages
        const systemMessage = `✅ Payment confirmed for request ${resolvedRequest.id}. Customer contact: ${resolvedRequest.contact_info || "N/A"}.`;
        if (!wasAlreadyPaid && resolvedRequest.vendor_id) {
          const { data: existingMessage, error: existingMessageError } = await supabaseAdmin
            .from("service_request_messages")
            .select("id")
            .eq("service_request_id", resolvedRequest.id)
            .eq("sender_role", "system")
            .ilike("message", "✅ Payment confirmed%")
            .maybeSingle();

          if (existingMessageError) {
            console.error("❌ Failed to check existing system message:", existingMessageError);
          } else if (!existingMessage) {
            const { error: systemMessageError } = await supabaseAdmin
              .from("service_request_messages")
              .insert({
                service_request_id: resolvedRequest.id,
                sender_id: resolvedRequest.vendor_id,
                sender_role: "system",
                message: systemMessage
              });

            if (systemMessageError) {
              console.error("❌ Failed to insert system payment message:", systemMessageError);
            }
          }
        }

        // Return early for service request payments (don't process regular orders)
        return NextResponse.json({
          success: true,
          message: "Payment verified and service request updated successfully",
          reference: transactionData.reference,
          amount: transactionData.amount / 100,
          status: transactionData.status,
          service_request_id: resolvedRequest.id,
        });
      }
    }

    // Calculate commission from transaction
    const commission = transactionData.metadata?.transaction_charge 
      ? transactionData.metadata.transaction_charge / 100 
      : amountPaid * 0.10; // Fallback to 10% if not in metadata

    return NextResponse.json({
      success: true,
      reference: transactionData.reference,
      amount: amountPaid,
      commission,
      status: transactionData.status,
      orders_created: createdOrdersCount,
      payment_record: paymentRecord,
      transaction: {
        id: transactionData.id,
        reference: transactionData.reference,
        amount: amountPaid,
        currency: transactionData.currency,
        status: transactionData.status,
        paid_at: transactionData.paid_at,
        metadata: transactionData.metadata,
      },
    });
  } catch (error) {
    console.error("❌ CRITICAL: Error verifying payment:", error);
    console.error("❌ Error stack:", error instanceof Error ? error.stack : "No stack trace");
    console.error("❌ Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
    });
    
    const errorMessage = error instanceof Error ? error.message : "Failed to verify payment";
    
    // CRITICAL: Even if verification fails, payment was successful
    // Return a response that allows the frontend to show success
    return NextResponse.json(
      {
        success: false,
        error: "Payment verification encountered an error",
        message: errorMessage,
        // Include reference so frontend can still show success
        reference: typeof requestBody === 'object' && requestBody !== null && 'reference' in requestBody 
          ? (requestBody as { reference?: string }).reference 
          : undefined,
        // Indicate that payment was likely successful even if verification failed
        payment_likely_successful: true,
      },
      { status: 500 }
    );
  }
}

