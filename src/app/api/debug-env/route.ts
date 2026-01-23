import { NextResponse } from "next/server";

// Debug endpoint to check environment variables
// This helps diagnose environment variable loading issues
export async function GET() {
  try {
    const paystackKey = process.env.PAYSTACK_SECRET_KEY;
    
    // Get the raw length for debugging
    const rawLength = paystackKey?.length || 0;
    
    // Log to server console for debugging
    console.log("🔍 ===== DEBUG ENDPOINT CALLED =====");
    console.log("🔍 process.env.PAYSTACK_SECRET_KEY:", paystackKey);
    console.log("🔍 Type:", typeof paystackKey);
    console.log("🔍 Length:", rawLength);
    console.log("🔍 Full value (JSON):", JSON.stringify(paystackKey));
    if (paystackKey) {
      console.log("🔍 First 20 chars:", paystackKey.substring(0, Math.min(20, paystackKey.length)));
      console.log("🔍 Char codes:", paystackKey.substring(0, Math.min(20, paystackKey.length)).split('').map((c, i) => `${i}: '${c}'=${c.charCodeAt(0)}`));
    }
    console.log("🔍 All env vars with PAYSTACK:", Object.keys(process.env).filter(k => k.includes('PAYSTACK')));
    console.log("🔍 NODE_ENV:", process.env.NODE_ENV);
    console.log("🔍 ===== END DEBUG =====");
    
    // Mask the key for security in response (show first 10 and last 4)
    const maskedKey = paystackKey 
      ? (paystackKey.length > 14 
          ? paystackKey.substring(0, 10) + "..." + paystackKey.substring(paystackKey.length - 4)
          : paystackKey.length > 0 
            ? "***" + paystackKey.substring(paystackKey.length - 4)
            : "EMPTY")
      : "NOT SET";
    
    // Safe helper to get prefix
    const getPrefix = (key: string | undefined): string => {
      if (!key || typeof key !== 'string') return "N/A";
      const length = key.length;
      return key.substring(0, Math.min(15, length));
    };

    // Safe helper to get suffix
    const getSuffix = (key: string | undefined): string => {
      if (!key || typeof key !== 'string') return "N/A";
      const length = key.length;
      return length > 4 ? key.substring(length - 4) : key;
    };

    const debugInfo = {
      paystackKeyExists: !!paystackKey,
      paystackKeyLength: rawLength,
      paystackKeyType: typeof paystackKey,
      paystackKeyValue: paystackKey ? JSON.stringify(paystackKey) : "undefined",
      paystackKeyPrefix: getPrefix(paystackKey),
      paystackKeySuffix: getSuffix(paystackKey),
      paystackKeyMasked: maskedKey,
      startsWithSkTest: paystackKey?.startsWith('sk_test_') || false,
      startsWithSkLive: paystackKey?.startsWith('sk_live_') || false,
      nodeEnv: process.env.NODE_ENV,
      // Check for common issues
      hasQuotes: paystackKey ? (paystackKey.includes('"') || paystackKey.includes("'")) : false,
      hasSpaces: paystackKey?.includes(' ') || false,
      charCodes: paystackKey ? paystackKey.substring(0, Math.min(20, paystackKey.length)).split('').map((c, i) => ({ index: i, char: c, code: c.charCodeAt(0), isVisible: c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126 })) : [],
      // List all PAYSTACK-related env vars
      allPaystackVars: Object.keys(process.env).filter(k => k.includes('PAYSTACK')),
      // Check if other env vars are loading
      otherEnvVarsLoading: {
        NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    };
    
    return NextResponse.json(
      {
        success: true,
        message: "Environment variable debug info",
        debug: debugInfo,
        instructions: [
          "1. Check that PAYSTACK_SECRET_KEY starts with 'sk_test_' or 'sk_live_'",
          "2. Ensure there are no spaces or quotes around the value in .env.local",
          "3. Make sure .env.local is in the project root (same directory as package.json)",
          "4. Restart your dev server after modifying .env.local",
          "5. The key should be on a single line: PAYSTACK_SECRET_KEY=sk_test_xxxxx",
          "6. Check the server console logs for detailed debugging information",
        ],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error in debug endpoint:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}

