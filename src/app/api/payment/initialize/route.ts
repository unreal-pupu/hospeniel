import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface InitializePaymentRequest {
  email: string;
  amount: number; // Amount in Naira (will be converted to kobo)
  vendor_id: string; // Vendor's profile_id (auth.users.id)
  order_id?: string;
  payment_id?: string;
  metadata?: Record<string, any>;
}

export async function POST(req: Request) {
  try {
    const body: InitializePaymentRequest = await req.json();
    const { email, amount, vendor_id, order_id, payment_id, metadata } = body;

    // Validate required fields
    if (!email || !amount || !vendor_id) {
      return NextResponse.json(
        { error: "Missing required fields: email, amount, and vendor_id are required" },
        { status: 400 }
      );
    }

    // Validate amount
    if (amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

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

    // Calculate commission (10% of total amount)
    const COMMISSION_RATE = 0.10;
    const commissionAmount = amount * COMMISSION_RATE;
    
    // Convert amount to kobo (Paystack uses kobo as the smallest currency unit)
    const amountInKobo = Math.round(amount * 100);
    const transactionChargeInKobo = Math.round(commissionAmount * 100);

    // Generate payment reference
    const paymentReference = payment_id 
      ? `payment_${payment_id}_${Date.now()}`
      : order_id
      ? `order_${order_id}_${Date.now()}`
      : `pay_${vendor_id}_${Date.now()}`;

    // Prepare callback URL for Paystack redirect
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/payment-success?reference=${paymentReference}`;

    // Prepare Paystack transaction initialization payload
    const paystackPayload: any = {
      email,
      amount: amountInKobo,
      currency: "NGN",
      reference: paymentReference,
      subaccount: vendorProfile.subaccount_code,
      transaction_charge: transactionChargeInKobo, // 10% commission in kobo
      callback_url: callbackUrl, // Redirect URL after payment
      metadata: {
        order_id: order_id || null,
        vendor_id,
        vendor_name: vendorProfile.name,
        payment_id: payment_id || null,
        description: "Order payment for Hospineil",
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
  } catch (error: any) {
    console.error("Error initializing payment:", error);
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: error.message || "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}

