import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

// Test endpoint to check if .env.local file exists and can be read
// This helps diagnose environment variable loading issues
export async function GET() {
  try {
    const projectRoot = process.cwd();
    const envLocalPath = join(projectRoot, ".env.local");
    const envPath = join(projectRoot, ".env");
    
    interface Results {
      projectRoot: string;
      envLocalPath: string;
      envPath: string;
      files: {
        envLocalExists: boolean;
        envExists: boolean;
      };
      envLocalContent: unknown;
      envContent: unknown;
      envLocalError?: string;
      envError?: string;
      [key: string]: unknown;
    }
    
    const results: Results = {
      projectRoot,
      envLocalPath,
      envPath,
      files: {
        envLocalExists: false,
        envExists: false,
      },
      envLocalContent: null,
      envContent: null,
    };
    
    try {
      // Check if .env.local exists
      const envLocalContent = readFileSync(envLocalPath, "utf-8");
      results.files.envLocalExists = true;
      
      // Extract PAYSTACK_SECRET_KEY from file content
      const paystackLine = envLocalContent
        .split("\n")
        .find((line) => line.trim().startsWith("PAYSTACK_SECRET_KEY="));
      
      if (paystackLine) {
        const keyValue = paystackLine.split("=").slice(1).join("=").trim();
        results.envLocalContent = {
          paystackLineFound: true,
          paystackLineLength: paystackLine.length,
          paystackValueLength: keyValue.length,
          paystackValuePrefix: keyValue.substring(0, Math.min(15, keyValue.length)),
          paystackValueSuffix: keyValue.length > 4 ? keyValue.substring(keyValue.length - 4) : keyValue,
          paystackValueHasQuotes: keyValue.startsWith('"') || keyValue.startsWith("'"),
          paystackValueHasSpaces: keyValue.includes(" "),
          first10CharCodes: keyValue.substring(0, Math.min(10, keyValue.length)).split("").map((c) => c.charCodeAt(0)),
          // Show first 100 chars of the file for debugging (masked)
          filePreview: envLocalContent.substring(0, Math.min(100, envLocalContent.length)).replace(/PAYSTACK_SECRET_KEY=[^\n]*/g, (match) => {
            const parts = match.split("=");
            if (parts.length > 1) {
              const key = parts[0];
              const value = parts.slice(1).join("=");
              return `${key}=${value.substring(0, 10)}...${value.substring(value.length - 4)}`;
            }
            return match;
          }),
        };
      } else {
        results.envLocalContent = {
          paystackLineFound: false,
          filePreview: envLocalContent.substring(0, Math.min(200, envLocalContent.length)),
        };
      }
    } catch (error) {
      results.files.envLocalExists = false;
      results.envLocalError = error instanceof Error ? error.message : "Unknown error";
    }
    
    try {
      // Check if .env exists
      const envContent = readFileSync(envPath, "utf-8");
      results.files.envExists = true;
      results.envContent = {
        filePreview: envContent.substring(0, Math.min(200, envContent.length)),
      };
    } catch (error) {
      results.files.envExists = false;
      results.envError = error instanceof Error ? error.message : "Unknown error";
    }
    
    // Also check what process.env has
    results.processEnv = {
      PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY
        ? {
            exists: true,
            length: process.env.PAYSTACK_SECRET_KEY.length,
            prefix: process.env.PAYSTACK_SECRET_KEY.substring(0, Math.min(15, process.env.PAYSTACK_SECRET_KEY.length)),
            suffix: process.env.PAYSTACK_SECRET_KEY.length > 4
              ? process.env.PAYSTACK_SECRET_KEY.substring(process.env.PAYSTACK_SECRET_KEY.length - 4)
              : process.env.PAYSTACK_SECRET_KEY,
            first10CharCodes: process.env.PAYSTACK_SECRET_KEY
              .substring(0, Math.min(10, process.env.PAYSTACK_SECRET_KEY.length))
              .split("")
              .map((c) => c.charCodeAt(0)),
          }
        : { exists: false },
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    };
    
    return NextResponse.json(
      {
        success: true,
        message: "Environment file check",
        results,
        instructions: [
          "1. Check if .env.local exists and contains PAYSTACK_SECRET_KEY",
          "2. Verify the key value doesn't have quotes or spaces",
          "3. Ensure the file is in the project root",
          "4. Restart the dev server after making changes",
        ],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error in test-env-file endpoint:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        stack: process.env.NODE_ENV === "development" ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}



