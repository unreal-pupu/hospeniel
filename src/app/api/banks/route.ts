import { NextResponse } from "next/server";

// Paystack Bank List API endpoint
const PAYSTACK_BANKS_URL = "https://api.paystack.co/bank";

// Fallback bank list including Moniepoint and other popular Nigerian banks
const FALLBACK_BANKS = [
  { id: 302, name: "9mobile 9Payment Service Bank", code: "120001", active: true, pay_with_bank: true },
  { id: 174, name: "Access Bank", code: "044", active: true, pay_with_bank: true },
  { id: 175, name: "Access Bank (Diamond)", code: "063", active: true, pay_with_bank: true },
  { id: 176, name: "ALAT by WEMA", code: "035A", active: true, pay_with_bank: true },
  { id: 177, name: "ASO Savings and Loans", code: "401", active: true, pay_with_bank: true },
  { id: 178, name: "Bowen Microfinance Bank", code: "50931", active: true, pay_with_bank: true },
  { id: 179, name: "CEMCS Microfinance Bank", code: "50823", active: true, pay_with_bank: true },
  { id: 180, name: "Citibank Nigeria", code: "023", active: true, pay_with_bank: true },
  { id: 181, name: "Coronation Merchant Bank", code: "559", active: true, pay_with_bank: true },
  { id: 182, name: "Ecobank Nigeria", code: "050", active: true, pay_with_bank: true },
  { id: 183, name: "Ekondo Microfinance Bank", code: "562", active: true, pay_with_bank: true },
  { id: 184, name: "Fidelity Bank", code: "070", active: true, pay_with_bank: true },
  { id: 185, name: "First Bank of Nigeria", code: "011", active: true, pay_with_bank: true },
  { id: 186, name: "First City Monument Bank", code: "214", active: true, pay_with_bank: true },
  { id: 187, name: "Globus Bank", code: "00103", active: true, pay_with_bank: true },
  { id: 188, name: "Guaranty Trust Bank", code: "058", active: true, pay_with_bank: true },
  { id: 189, name: "Hasal Microfinance Bank", code: "50383", active: true, pay_with_bank: true },
  { id: 190, name: "Heritage Bank", code: "030", active: true, pay_with_bank: true },
  { id: 191, name: "Jaiz Bank", code: "301", active: true, pay_with_bank: true },
  { id: 192, name: "Keystone Bank", code: "082", active: true, pay_with_bank: true },
  { id: 193, name: "Kuda Bank", code: "50211", active: true, pay_with_bank: true },
  { id: 194, name: "Moniepoint", code: "50515", active: true, pay_with_bank: true },
  { id: 195, name: "Parallex Bank", code: "526", active: true, pay_with_bank: true },
  { id: 196, name: "Parkway - ReadyCash", code: "311", active: true, pay_with_bank: true },
  { id: 197, name: "Polaris Bank", code: "076", active: true, pay_with_bank: true },
  { id: 198, name: "Providus Bank", code: "101", active: true, pay_with_bank: true },
  { id: 199, name: "Rubies MFB", code: "125", active: true, pay_with_bank: true },
  { id: 200, name: "Sparkle Microfinance Bank", code: "51310", active: true, pay_with_bank: true },
  { id: 201, name: "Stanbic IBTC Bank", code: "221", active: true, pay_with_bank: true },
  { id: 202, name: "Standard Chartered Bank", code: "068", active: true, pay_with_bank: true },
  { id: 203, name: "Sterling Bank", code: "232", active: true, pay_with_bank: true },
  { id: 204, name: "Suntrust Bank", code: "100", active: true, pay_with_bank: true },
  { id: 205, name: "TAJ Bank", code: "302", active: true, pay_with_bank: true },
  { id: 206, name: "Tangerine Money", code: "51269", active: true, pay_with_bank: true },
  { id: 207, name: "TCF MFB", code: "51211", active: true, pay_with_bank: true },
  { id: 208, name: "Titan Bank", code: "102", active: true, pay_with_bank: true },
  { id: 209, name: "Union Bank of Nigeria", code: "032", active: true, pay_with_bank: true },
  { id: 210, name: "United Bank For Africa", code: "033", active: true, pay_with_bank: true },
  { id: 211, name: "Unity Bank", code: "215", active: true, pay_with_bank: true },
  { id: 212, name: "VFD Microfinance Bank Limited", code: "566", active: true, pay_with_bank: true },
  { id: 213, name: "Wema Bank", code: "035", active: true, pay_with_bank: true },
  { id: 214, name: "Zenith Bank", code: "057", active: true, pay_with_bank: true },
];

export async function GET() {
  try {
    // Get Paystack secret key from environment variables
    // Use server-side environment variable (not NEXT_PUBLIC_*)
    const secretKeyRaw = process.env.PAYSTACK_SECRET_KEY;
    
    // Debug logging
    console.log("🔍 [BANKS API] PAYSTACK_SECRET_KEY check:");
    console.log("🔍 [BANKS API] Key exists:", !!secretKeyRaw);
    console.log("🔍 [BANKS API] Key type:", typeof secretKeyRaw);
    console.log("🔍 [BANKS API] Key length:", secretKeyRaw?.length || 0);
    if (secretKeyRaw) {
      console.log("🔍 [BANKS API] Key value (raw, JSON):", JSON.stringify(secretKeyRaw));
      console.log("🔍 [BANKS API] First 20 chars:", JSON.stringify(secretKeyRaw.substring(0, Math.min(20, secretKeyRaw.length))));
      console.log("🔍 [BANKS API] Char codes (first 10):", secretKeyRaw.substring(0, Math.min(10, secretKeyRaw.length)).split('').map(c => c.charCodeAt(0)));
    }
    
    // Trim whitespace and validate
    const secretKey = secretKeyRaw ? secretKeyRaw.trim() : null;

    if (!secretKey || secretKey === '') {
      console.warn("⚠️ PAYSTACK_SECRET_KEY is not set. Using fallback bank list.");
      // Return fallback banks if key is not set
      return NextResponse.json(
        {
          success: true,
          banks: FALLBACK_BANKS,
          source: "fallback",
        },
        { status: 200 }
      );
    }

    // Validate that the key starts with 'sk_test_' or 'sk_live_'
    const trimmedKey = secretKey.trim();
    const startsWithSkTest = trimmedKey.startsWith('sk_test_');
    const startsWithSkLive = trimmedKey.startsWith('sk_live_');
    
    if (!startsWithSkTest && !startsWithSkLive) {
      console.warn("⚠️ PAYSTACK_SECRET_KEY format may be invalid.");
      console.warn("🔍 [BANKS API] Key prefix:", JSON.stringify(trimmedKey.substring(0, Math.min(10, trimmedKey.length))));
      console.warn("🔍 [BANKS API] Starts with 'sk_test_':", startsWithSkTest);
      console.warn("🔍 [BANKS API] Starts with 'sk_live_':", startsWithSkLive);
      console.warn("⚠️ Using fallback bank list.");
      // Return fallback banks if key format is invalid
      return NextResponse.json(
        {
          success: true,
          banks: FALLBACK_BANKS,
          source: "fallback",
        },
        { status: 200 }
      );
    }

    // Try to fetch banks from Paystack API
    try {
      // Clean the key (remove any hidden characters)
      const cleanedKey = trimmedKey.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
      
      console.log("🔄 Fetching banks from Paystack API with key (length:", cleanedKey.length + ", prefix:", cleanedKey.substring(0, 10) + ")");
      
      const response = await fetch(PAYSTACK_BANKS_URL, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${cleanedKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn("⚠️ Paystack API error, using fallback bank list:", errorData.message || "Unknown error");
        // Return fallback banks if API call fails
        return NextResponse.json(
          {
            success: true,
            banks: FALLBACK_BANKS,
            source: "fallback",
          },
          { status: 200 }
        );
      }

      const data = await response.json();

      if (!data.status || !data.data || !Array.isArray(data.data)) {
        console.warn("⚠️ Invalid response from Paystack, using fallback bank list");
        return NextResponse.json(
          {
            success: true,
            banks: FALLBACK_BANKS,
            source: "fallback",
          },
          { status: 200 }
        );
      }

      // Ensure Moniepoint is in the list (add if missing)
      const banks = [...data.data] as Array<{ name?: string; code?: string; [key: string]: unknown }>;
      const moniepointExists = banks.some((bank) => 
        bank.name?.toLowerCase().includes('moniepoint') || 
        bank.code === '50515'
      );

      if (!moniepointExists) {
        banks.push({
          id: 999999,
          name: "Moniepoint",
          code: "50515",
          active: true,
          pay_with_bank: true,
          type: "nuban",
          currency: "NGN",
          country: "Nigeria",
        });
      }

      // Return banks from Paystack API
      return NextResponse.json(
        {
          success: true,
          banks: banks,
          source: "paystack",
        },
        { status: 200 }
      );
    } catch (apiError) {
      const errorMessage = apiError instanceof Error ? apiError.message : "Unknown error";
      console.warn("⚠️ Error calling Paystack API, using fallback bank list:", errorMessage);
      // Return fallback banks if there's an error
      return NextResponse.json(
        {
          success: true,
          banks: FALLBACK_BANKS,
          source: "fallback",
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Error in banks API route:", error);
    // Always return fallback banks on error
    return NextResponse.json(
      {
        success: true,
        banks: FALLBACK_BANKS,
        source: "fallback",
      },
      { status: 200 }
    );
  }
}

