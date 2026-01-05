import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { reference, pending_orders, delivery_details } = body;
    
    // Extract delivery details and charge
    const deliveryAddress = delivery_details?.address || delivery_details?.delivery_address_line_1 || "";
    const deliveryCity = delivery_details?.city || delivery_details?.delivery_city || "";
    const deliveryState = delivery_details?.state || delivery_details?.delivery_state || "";
    const deliveryPostalCode = delivery_details?.postal_code || delivery_details?.delivery_postal_code || "";
    const deliveryPhone = delivery_details?.phone || delivery_details?.delivery_phone_number || "";
    const deliveryCharge = delivery_details?.delivery_charge || 0;

    if (!reference) {
      return NextResponse.json(
        { error: "Payment reference is required" },
        { status: 400 }
      );
    }

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
    let createdOrders: any[] = [];
    
    if (pending_orders && Array.isArray(pending_orders) && pending_orders.length > 0) {
      console.log(`🔄 Processing ${pending_orders.length} pending order(s)...`);
      
      // Validate and prepare orders with all required fields
      const ordersWithRef = pending_orders
        .filter((order: any) => {
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
        .map((order: any) => {
          // Use extracted delivery details
          const preparedOrder: any = {
            user_id: order.user_id,
            vendor_id: order.vendor_id, // This should be the vendor's auth.users.id
            product_id: order.product_id,
            quantity: order.quantity || 1,
            total_price: order.total_price || 0,
            payment_reference: reference,
            status: "Paid",
          };

          // Add delivery address fields only if they have values
          if (deliveryAddress) {
            preparedOrder.delivery_address_line_1 = deliveryAddress;
          }
          if (deliveryCity) {
            preparedOrder.delivery_city = deliveryCity;
          }
          if (deliveryState) {
            preparedOrder.delivery_state = deliveryState;
          }
          if (deliveryPostalCode) {
            preparedOrder.delivery_postal_code = deliveryPostalCode;
          }
          if (deliveryPhone) {
            preparedOrder.delivery_phone_number = deliveryPhone;
          }
          if (deliveryCharge && deliveryCharge > 0) {
            preparedOrder.delivery_charge = deliveryCharge;
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
          
          // Fetch existing orders to create notifications
          const { data: existingOrdersFull } = await supabaseAdmin
            .from("orders")
            .select("id, vendor_id")
            .eq("payment_reference", reference);
          
          if (existingOrdersFull) {
            createdOrders = existingOrdersFull;
          }
        } else {
          const { data: insertedOrders, error: ordersError } = await supabaseAdmin
            .from("orders")
            .insert(ordersWithRef)
            .select();

          if (ordersError) {
            console.error("❌ Error creating orders:", ordersError);
            console.error("❌ Orders data that failed:", ordersWithRef);
            console.error("❌ Error details:", {
              code: ordersError.code,
              message: ordersError.message,
              details: ordersError.details,
              hint: ordersError.hint,
            });
            // Log error but continue - payment is successful
            // The database trigger should still create notifications if orders are created later
          } else {
            createdOrders = insertedOrders || [];
            createdOrdersCount = createdOrders.length;
            console.log(`✅ Successfully created ${createdOrdersCount} order(s)`);
            if (createdOrders.length > 0) {
              console.log("✅ Created order IDs:", createdOrders.map((o: any) => o.id));
              console.log("✅ Created order vendor_ids:", createdOrders.map((o: any) => o.vendor_id));
            }
          }
        }
        
        // Create notifications for vendors about new orders (if we have created orders)
        if (createdOrders.length > 0) {
          const vendorIds = [...new Set(createdOrders.map((o: any) => o.vendor_id))];
          console.log(`📬 Creating notifications for ${vendorIds.length} vendor(s)...`);
          
          for (const vendorId of vendorIds) {
            const vendorOrders = createdOrders.filter((o: any) => o.vendor_id === vendorId);
            const { error: notifError } = await supabaseAdmin
              .from("notifications")
              .insert({
                vendor_id: vendorId,
                message: `You have ${vendorOrders.length} new order(s) waiting for your response!`,
                type: "new_order",
                read: false,
              });
            
            if (notifError) {
              console.error(`❌ Error creating notification for vendor ${vendorId}:`, notifError);
            } else {
              console.log(`✅ Notification created for vendor ${vendorId}`);
            }
          }
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

    // Calculate commission from transaction
    const amountPaid = transactionData.amount / 100; // Convert from kobo to Naira
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
  } catch (error: any) {
    console.error("Error verifying payment:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: error.message || "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}

