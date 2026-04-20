import { NextResponse } from "next/server";
import { PLATFORM_FOOD_COMMISSION_RATE } from "@/lib/platformPricing";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { parseJsonBody } from "@/lib/validation/http";
import { paymentInitializeSchema } from "@/lib/validation/schemas";

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const parsed = await parseJsonBody(req, paymentInitializeSchema, "POST /api/payment/initialize");
    if (!parsed.ok) return parsed.response;

    const {
      email,
      amount,
      food_amount,
      delivery_fee,
      vat_amount,
      service_charge,
      vendor_id,
      order_id,
      payment_id,
      metadata,
      pending_orders,
      delivery_details,
    } = parsed.data;

    // Get Paystack secret key from environment
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      console.error("PAYSTACK_SECRET_KEY is not set in environment variables");
      return NextResponse.json(
        { error: "Payment service is not configured. Please contact support." },
        { status: 500 }
      );
    }

    // Validate key format (should start with sk_test_ or sk_live_)
    const trimmedKey = secretKey.trim();
    const isValidKey = trimmedKey.startsWith("sk_test_") || trimmedKey.startsWith("sk_live_");
    if (!isValidKey) {
      console.error("Invalid PAYSTACK_SECRET_KEY format");
      return NextResponse.json(
        { error: "Payment service configuration error. Please contact support." },
        { status: 500 }
      );
    }

    // Fetch vendor's subaccount_code from profiles table
    const { data: vendorProfile, error: vendorError } = await supabaseAdmin
      .from("profiles")
      .select("id, name, subaccount_code")
      .eq("id", vendor_id)
      .eq("role", "vendor")
      .single();

    if (vendorError || !vendorProfile) {
      console.error("Error fetching vendor profile:", vendorError);
      return NextResponse.json(
        { error: "Vendor not found or invalid vendor ID" },
        { status: 404 }
      );
    }

    if (!vendorProfile.subaccount_code) {
      console.error("Vendor does not have a subaccount_code:", vendor_id);
      return NextResponse.json(
        { 
          error: "Vendor payment account is not set up. Please contact the vendor or support.",
          vendor_id,
          vendor_name: vendorProfile.name,
        },
        { status: 400 }
      );
    }

    const deliveryFeeFromDetails =
      typeof (delivery_details as { delivery_charge?: number })?.delivery_charge === "number"
        ? (delivery_details as { delivery_charge?: number }).delivery_charge
        : 0;
    const resolvedDeliveryFee =
      typeof delivery_fee === "number"
        ? delivery_fee
        : deliveryFeeFromDetails;
    const resolvedServiceCharge =
      typeof service_charge === "number"
        ? service_charge
        : typeof metadata?.service_charge === "number"
        ? metadata.service_charge
        : 0;
    const resolvedFoodAmount =
      typeof food_amount === "number"
        ? food_amount
        : Math.max(amount - (resolvedDeliveryFee || 0) - resolvedServiceCharge, 0);
    const resolvedVatAmount =
      typeof vat_amount === "number"
        ? vat_amount
        : Math.max(amount - resolvedFoodAmount - (resolvedDeliveryFee || 0) - resolvedServiceCharge, 0);

    const commissionAmount = resolvedFoodAmount * PLATFORM_FOOD_COMMISSION_RATE;
    const platformShareAmount = commissionAmount + (resolvedDeliveryFee || 0) + resolvedVatAmount + resolvedServiceCharge;
    
    // Convert amount to kobo (Paystack uses kobo as the smallest currency unit)
    const amountInKobo = Math.round(amount * 100);
    const transactionChargeInKobo = Math.round(platformShareAmount * 100);

    // Generate payment reference
    const paymentReference = payment_id 
      ? `payment_${payment_id}_${Date.now()}`
      : order_id
      ? `order_${order_id}_${Date.now()}`
      : `pay_${vendor_id}_${Date.now()}`;

    // Prepare callback URL for Paystack redirect
    const baseCallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.hospeniel.com'}/payment-success`;
    const serviceRequestId = typeof metadata?.service_request_id === "string" ? metadata.service_request_id : undefined;
    const callbackUrl = serviceRequestId
      ? `${baseCallbackUrl}?reference=${paymentReference}&service_request_id=${serviceRequestId}`
      : `${baseCallbackUrl}?reference=${paymentReference}`;

    // Prepare Paystack transaction initialization payload
    const paystackPayload: {
      email: string;
      amount: number;
      currency: string;
      reference: string;
      subaccount?: string;
      transaction_charge?: number;
      bearer?: "account" | "subaccount";
      callback_url?: string;
      metadata?: Record<string, unknown>;
    } = {
      email,
      amount: amountInKobo,
      currency: "NGN",
      reference: paymentReference,
      subaccount: vendorProfile.subaccount_code,
      transaction_charge: transactionChargeInKobo,
      bearer: "account", // Platform absorbs Paystack fees; vendor gets remainder after split
      callback_url: callbackUrl, // Redirect URL after payment
      metadata: {
        order_id: order_id || null,
        vendor_id,
        vendor_name: vendorProfile.name,
        payment_id: payment_id || null,
        description: "Order payment for Hospineil",
        food_amount: resolvedFoodAmount,
        delivery_fee: resolvedDeliveryFee || 0,
        vat_amount: resolvedVatAmount,
        service_charge: resolvedServiceCharge,
        commission_amount: commissionAmount,
        platform_share_amount: platformShareAmount,
        transaction_charge_kobo: transactionChargeInKobo, // Platform share in kobo
        ...metadata,
      },
    };

    console.log("🔄 Initializing Paystack transaction with subaccount:", {
      vendor_id,
      vendor_name: vendorProfile.name,
      subaccount_code: vendorProfile.subaccount_code,
      amount: amount,
      commission: commissionAmount,
      reference: paymentReference,
    });

    // Initialize Paystack transaction
    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${trimmedKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paystackPayload),
    });

    const paystackData = await paystackResponse.json();

    if (!paystackResponse.ok || !paystackData.status) {
      console.error("Paystack API error:", paystackData);
      return NextResponse.json(
        { 
          error: paystackData.message || "Failed to initialize payment",
          details: paystackData,
        },
        { status: paystackResponse.status || 500 }
      );
    }

    if (payment_id) {
      const { error: paymentUpdateError } = await supabaseAdmin
        .from("payments")
        .update({
          payment_reference: paystackData.data.reference,
          pending_orders: pending_orders ?? null,
          delivery_details: delivery_details ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment_id);

      if (paymentUpdateError) {
        console.error("⚠️ Failed to persist payment payload:", paymentUpdateError);
      }
    }

    // If this is a service request payment, persist the reference immediately
    if (serviceRequestId) {
      const { error: serviceRequestUpdateError } = await supabaseAdmin
        .from("service_requests")
        .update({
          payment_reference: paystackData.data.reference,
          payment_method: "paystack",
          payment_status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", serviceRequestId);

      if (serviceRequestUpdateError) {
        console.error("⚠️ Failed to persist service request payment reference:", serviceRequestUpdateError);
      } else {
        console.log("✅ Service request payment reference saved:", serviceRequestId);
      }
    }

    // Return authorization URL and reference for frontend
    return NextResponse.json({
      success: true,
      authorization_url: paystackData.data.authorization_url,
      access_code: paystackData.data.access_code,
      reference: paystackData.data.reference,
      amount: amount,
      commission: commissionAmount,
      vendor_subaccount: vendorProfile.subaccount_code,
    });
  } catch (error) {
    console.error("Error initializing payment:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}


