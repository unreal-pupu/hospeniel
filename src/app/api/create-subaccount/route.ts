import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { PAYSTACK_VENDOR_SUBACCOUNT_PERCENTAGE_CHARGE } from "@/lib/platformPricing";
import { ensureAuthenticatedRequest } from "@/lib/api/ensureAuthenticatedRequest";

// Paystack Subaccount API endpoint
const PAYSTACK_SUBACCOUNT_URL = "https://api.paystack.co/subaccount";

export async function POST(req: Request) {
  try {
    const authCheck = await ensureAuthenticatedRequest(req);
    if (!authCheck.ok) return authCheck.response;
    const { userId: authenticatedUserId, isAdmin } = authCheck.context;

    const supabaseAdmin = getSupabaseAdminClient();
    // Get Paystack secret key from environment variables
    // Use server-side environment variable (not NEXT_PUBLIC_*)
    const paystackSecretKeyRaw = process.env.PAYSTACK_SECRET_KEY;
    
    // Trim whitespace and remove any hidden characters
    const paystackSecretKey = paystackSecretKeyRaw 
      ? paystackSecretKeyRaw.trim().replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces and BOM
      : null;
    
    // Validate environment variables
    if (!paystackSecretKey || paystackSecretKey === '') {
      console.error("❌ PAYSTACK_SECRET_KEY is not set or empty after trimming");
      console.log("🔍 Raw value type:", typeof paystackSecretKeyRaw);
      console.log("🔍 Raw value length:", paystackSecretKeyRaw?.length);
      return NextResponse.json(
        { 
          success: false, 
          error: "Paystack secret key is not configured. Please set PAYSTACK_SECRET_KEY in your .env.local file and restart your dev server.",
          debug: process.env.NODE_ENV === 'development' ? {
            keyExists: !!paystackSecretKeyRaw,
            keyLength: paystackSecretKeyRaw?.length,
            keyType: typeof paystackSecretKeyRaw,
            firstChars: paystackSecretKeyRaw?.substring(0, 10),
          } : undefined
        },
        { status: 500 }
      );
    }

    // Validate that the key starts with 'sk_test_' or 'sk_live_'
    // Check the actual prefix more carefully
    const keyPrefix = paystackSecretKey.substring(0, 8);
    const isValidTestKey = paystackSecretKey.startsWith('sk_test_');
    const isValidLiveKey = paystackSecretKey.startsWith('sk_live_');
    
    if (!isValidTestKey && !isValidLiveKey) {
      console.error("❌ PAYSTACK_SECRET_KEY format is invalid");
      console.error("🔍 Key prefix (first 8 chars):", JSON.stringify(keyPrefix));
      console.error("🔍 Key prefix (first 10 chars):", JSON.stringify(paystackSecretKey.substring(0, 10)));
      console.error("🔍 Key length:", paystackSecretKey.length);
      console.error("🔍 Starts with 'sk_test_':", isValidTestKey);
      console.error("🔍 Starts with 'sk_live_':", isValidLiveKey);
      console.error("🔍 Char codes of first 10 chars:", paystackSecretKey.substring(0, 10).split('').map(c => c.charCodeAt(0)));
      
      return NextResponse.json(
        { 
          success: false, 
          error: "Invalid Paystack secret key format. Key should start with 'sk_live_' (for production) or 'sk_test_' (for test mode). Please check your PAYSTACK_SECRET_KEY in your .env.local file and ensure there are no spaces or quotes.",
          debug: process.env.NODE_ENV === 'development' ? {
            keyLength: paystackSecretKey.length,
            keyPrefix: keyPrefix,
            first10Chars: paystackSecretKey.substring(0, 10),
            charCodes: paystackSecretKey.substring(0, 10).split('').map(c => c.charCodeAt(0)),
            startsWithSkTest: isValidTestKey,
            startsWithSkLive: isValidLiveKey,
          } : undefined
        },
        { status: 500 }
      );
    }
    
    console.log("✅ Paystack secret key validation passed. Key type:", isValidTestKey ? "TEST" : "LIVE");

    const body = await req.json();
    const {
      business_name,
      bank_code,
      account_number,
      user_id,
      percentage_charge = PAYSTACK_VENDOR_SUBACCOUNT_PERCENTAGE_CHARGE,
    } = body;

    if (!user_id) {
      return NextResponse.json(
        { success: false, error: "user_id is required" },
        { status: 400 }
      );
    }

    if (!isAdmin && user_id !== authenticatedUserId) {
      return NextResponse.json(
        { success: false, error: "Forbidden. You can only create a subaccount for your own vendor profile." },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!business_name || !bank_code || !account_number || !user_id) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: business_name, bank_code, account_number, and user_id are required",
        },
        { status: 400 }
      );
    }

    // Validate account number (should be numeric and at least 10 digits)
    if (!/^\d{10,}$/.test(account_number)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid account number. Account number must be at least 10 digits.",
        },
        { status: 400 }
      );
    }

    // Validate percentage_charge (should be between 0 and 100)
    if (percentage_charge < 0 || percentage_charge > 100) {
      return NextResponse.json(
        {
          success: false,
          error: "Percentage charge must be between 0 and 100",
        },
        { status: 400 }
      );
    }

    // Check if user exists and is a vendor
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, subaccount_code, email")
      .eq("id", user_id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        {
          success: false,
          error: "User profile not found",
        },
        { status: 404 }
      );
    }

    if (profile.role !== "vendor") {
      return NextResponse.json(
        {
          success: false,
          error: "Only vendors can create subaccounts",
        },
        { status: 403 }
      );
    }

    // If subaccount already exists, return it
    if (profile.subaccount_code) {
      return NextResponse.json(
        {
          success: true,
          message: "Subaccount already exists",
          subaccount_code: profile.subaccount_code,
        },
        { status: 200 }
      );
    }

    // Create subaccount via Paystack API
    const paystackPayload = {
      business_name,
      settlement_bank: bank_code,
      account_number,
      percentage_charge,
      primary_contact_email: profile.email || undefined,
      primary_contact_name: business_name,
      settlement_schedule: "AUTO", // Automatic settlement
    };

    console.log("Creating Paystack subaccount with payload:", {
      ...paystackPayload,
      account_number: "***" + account_number.slice(-4), // Log only last 4 digits for security
    });

    // Use the validated and cleaned key
    const cleanedKey = paystackSecretKey.trim();
    console.log("🔄 Making Paystack API call with cleaned key (length:", cleanedKey.length + ")");

    const paystackResponse = await fetch(PAYSTACK_SUBACCOUNT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cleanedKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paystackPayload),
    });

    if (!paystackResponse.ok) {
      const errorData = await paystackResponse.json().catch(() => ({}));
      console.error("Paystack subaccount creation error:", errorData);
      return NextResponse.json(
        {
          success: false,
          error: errorData.message || "Failed to create Paystack subaccount",
          details: errorData,
        },
        { status: paystackResponse.status }
      );
    }

    const paystackData = await paystackResponse.json();

    if (!paystackData.status || !paystackData.data) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid response from Paystack",
        },
        { status: 500 }
      );
    }

    const subaccountCode = paystackData.data.subaccount_code;

    if (!subaccountCode) {
      return NextResponse.json(
        {
          success: false,
          error: "Subaccount code not returned from Paystack",
        },
        { status: 500 }
      );
    }

    // Store subaccount_code in profiles table
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ subaccount_code: subaccountCode })
      .eq("id", user_id);

    if (updateError) {
      console.error("Error updating profile with subaccount_code:", updateError);
      // Note: Subaccount was created in Paystack but not saved in DB
      // This is a critical error - the subaccount exists but we can't track it
      return NextResponse.json(
        {
          success: false,
          error: "Subaccount created but failed to save to database",
          subaccount_code: subaccountCode, // Return it anyway so it can be manually saved
        },
        { status: 500 }
      );
    }

    console.log("✅ Subaccount created successfully:", {
      user_id,
      subaccount_code: subaccountCode,
      business_name,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Subaccount created successfully",
        subaccount_code: subaccountCode,
        data: paystackData.data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error creating subaccount:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create subaccount";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

