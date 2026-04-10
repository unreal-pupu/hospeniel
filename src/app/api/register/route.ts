import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { checkRateLimit, RateLimitConfigs } from "@/lib/rateLimiter";
import { validatePassword } from "@/lib/passwordValidation";
import { parseJsonBody } from "@/lib/validation/http";
import { registerRequestSchema } from "@/lib/validation/schemas";

export async function POST(req: Request) {
  const supabaseAdmin = getSupabaseAdminClient();
  // Rate limiting: 3 registrations per hour per IP
  const rateLimitResult = checkRateLimit(
    "/api/register",
    req,
    RateLimitConfigs.REGISTRATION
  );

  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Too many registration attempts. Please try again later.",
        retryAfter: rateLimitResult.retryAfter,
        message: `Rate limit exceeded. Please wait ${rateLimitResult.retryAfter} seconds before trying again.`,
      },
      {
        status: 429,
        headers: {
          "Retry-After": rateLimitResult.retryAfter?.toString() || "3600",
          "X-RateLimit-Limit": RateLimitConfigs.REGISTRATION.maxRequests.toString(),
          "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
          "X-RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString(),
        },
      }
    );
  }
  try {
    const parsed = await parseJsonBody(req, registerRequestSchema, "POST /api/register");
    if (!parsed.ok) return parsed.response;

    const body = parsed.data;
    const email = body.email;
    const password = body.password;
    const name = body.name;
    const role = body.role;
    const category = body.category ?? null;
    const bank_code = body.bank_code ?? null;
    const account_number = body.account_number ?? null;
    const business_name = body.business_name ?? null;
    const phone_number = body.phone_number ?? null;

    // ✅ SECURITY: Never log passwords - only log non-sensitive data
    console.log("🟢 Registering user with data:", {
      email,
      role,
      address: body.address ?? "(empty)",
      category: category ?? "(empty)",
      phone_number: phone_number ?? "(empty)",
    });

    // ✅ SECURITY: Validate password strength before creating user
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: "Password does not meet security requirements",
          details: passwordValidation.errors,
          message: passwordValidation.errors.join(". "),
        },
        { status: 400 }
      );
    }

    // ✅ Step 1: Create user in Supabase Auth securely
    // Supabase Auth automatically hashes the password using bcrypt
    // The password is never stored in plain text - it goes directly to auth.users.encrypted_password
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password, // This will be automatically hashed by Supabase Auth before storage
        email_confirm: true,
        user_metadata: { role },
      });

    if (authError || !authData?.user) {
      console.error("❌ Auth creation failed:", authError);
      return NextResponse.json(
        { success: false, error: authError?.message || "Auth creation failed" },
        { status: 400 }
      );
    }

    const user = authData.user;

    // ✅ Step 2: Upsert profile record
    // ✅ SECURITY: Never store password in profile - passwords are only in auth.users
    // Build profile data object conditionally to avoid schema cache issues
    
    const addressValue = body.address ?? "";
    
    // Build profile data object - ensure all fields are always defined
    const profileData: {
      id: string;
      email: string;
      name: string;
      role: string;
      address: string;
      location?: string | null;
      category?: string | null;
      business_name?: string | null;
      phone_number?: string | null;
      rider_approval_status?: string | null;
      approval_status?: string | null;
      is_available?: boolean;
      [key: string]: unknown;
    } = {
      id: user.id,
      email: email || "",
      name: name || "",
      role: role || "user",
      address: addressValue, // Always set address (empty string if not provided)
      is_admin: false, // ✅ SECURITY: Explicitly set to false - never allow registration as admin
      // ✅ SECURITY: Password is NEVER stored here - it's only in auth.users.encrypted_password
    };
    
    // Add location for vendors and riders - use body.location directly
    if (role === "vendor" || role === "rider") {
      profileData.location = body.location ?? null;
    } else {
      profileData.location = null;
    }

    // Only add category if role is vendor (to avoid schema cache errors)
    if (role === "vendor") {
      profileData.category = category || null;
      profileData.subscription_plan = "free_trial";
      profileData.is_premium = false;
      profileData.approval_status = "pending";
    }

    // Add phone number for users, riders, and vendors (ensure it's always a string or null)
    if (role === "user" || role === "rider" || role === "vendor") {
      profileData.phone_number = phone_number ?? null;
    }

    // Set rider approval status to pending for new rider registrations
    if (role === "rider") {
      profileData.rider_approval_status = "pending";
      // Set is_available to true by default for new riders
      profileData.is_available = true;
    }

    // Log profile data before insert for debugging
    // Use JSON.stringify to safely log the data without referencing variables
    console.log("📝 Profile data to insert:", JSON.stringify({
      id: profileData.id,
      email: profileData.email,
      name: profileData.name,
      role: profileData.role,
      address: profileData.address || "(empty)",
      location: profileData.location || "(empty)",
      category: profileData.category || "(empty)",
      phone_number: profileData.phone_number || "(empty)",
    }, null, 2));

    const { error: profileError, data: profileDataResult } = await supabaseAdmin
      .from("profiles")
      .upsert(profileData, { onConflict: "id" })
      .select();

    if (profileError) {
      console.error("❌ Profile upsert failed:", profileError);
      // Safely log profile data without referencing undefined variables
      console.error("❌ Profile data that failed:", JSON.stringify(profileData, null, 2));
      console.error("❌ Error details:", JSON.stringify({
        message: profileError?.message || "Unknown error",
        code: profileError?.code || "Unknown",
        details: profileError?.details || null,
        hint: profileError?.hint || null,
      }, null, 2));
      
      // Delete the auth user if profile creation failed
      try {
        await supabaseAdmin.auth.admin.deleteUser(user.id);
        console.log("🗑️ Deleted auth user after profile creation failure");
      } catch (deleteError) {
        console.error("⚠️ Failed to delete auth user:", deleteError);
      }
      
      // Return more detailed error message
      return NextResponse.json(
        { 
          success: false, 
          error: profileError.message || "Failed to create profile",
          details: profileError.details,
          hint: profileError.hint,
          code: profileError.code,
          message: `Database error creating new user: ${profileError.message || "Unknown error"}. ${profileError.hint ? `Hint: ${profileError.hint}` : ""}`,
        },
        { status: 400 }
      );
    }

    console.log("✅ Profile created successfully:", profileDataResult);

    // ✅ Step 3: If vendor, also insert into "vendors" table
    if (role === "vendor") {
      const vendorName = business_name || name || "Vendor"; // Ensure we have a name
      // Use addressValue directly (already defined above) - it's safe to use here
      const vendorAddress = addressValue || "";
      const vendorLocation = body.location ?? null;
      const vendorCategory = body.category ?? null;
      const vendorPhoneNumber = phone_number ?? null;
      
      const vendorData = {
        profile_id: user.id, // link to profiles.id
        name: vendorName, // Always set name field (required by schema)
        business_name: vendorName, // use business_name if provided, otherwise use name
        address: vendorAddress,
        location: vendorLocation,
        category: vendorCategory,
        phone_number: vendorPhoneNumber, // Add phone number for vendors
        created_at: new Date().toISOString(),
      };

      const { error: vendorError } = await supabaseAdmin
        .from("vendors")
        .upsert(vendorData, { onConflict: "profile_id" });

      if (vendorError) {
        console.error("❌ Vendor insert failed:", vendorError);
        // Optional: You can still continue even if vendor insert fails
      } else {
        console.log("✅ Vendor record created successfully");
      }

      // ✅ Step 4: Create Paystack subaccount for vendor if bank details are provided
      if (bank_code && account_number) {
        try {
          // Get Paystack secret key from environment variables
          const paystackSecretKeyRaw = process.env.PAYSTACK_SECRET_KEY;
          const paystackSecretKey = paystackSecretKeyRaw 
            ? paystackSecretKeyRaw.trim().replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces and BOM
            : null;
          
          if (!paystackSecretKey) {
            console.warn("⚠️ Paystack secret key not configured. Skipping subaccount creation.");
          } else if (!paystackSecretKey.startsWith('sk_test_') && !paystackSecretKey.startsWith('sk_live_')) {
            console.error("❌ Invalid Paystack secret key format. Key should start with 'sk_test_' or 'sk_live_'. Skipping subaccount creation.");
            console.error("🔍 Key prefix:", paystackSecretKey.substring(0, 10));
          } else {
            const paystackPayload = {
              business_name: business_name || name,
              settlement_bank: bank_code,
              account_number,
              percentage_charge: 10, // Hospineil keeps 10% commission
              primary_contact_email: email,
              primary_contact_name: business_name || name,
              settlement_schedule: "AUTO", // Automatic settlement
            };

            console.log("🔄 Creating Paystack subaccount for vendor:", {
              user_id: user.id,
              business_name: paystackPayload.business_name,
              bank_code,
              account_number: "***" + account_number.slice(-4), // Log only last 4 digits
            });

            const paystackResponse = await fetch("https://api.paystack.co/subaccount", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${paystackSecretKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(paystackPayload),
            });

            if (paystackResponse.ok) {
              const paystackData = await paystackResponse.json();
              
              if (paystackData.status && paystackData.data?.subaccount_code) {
                const subaccountCode = paystackData.data.subaccount_code;
                
                // Update profile with subaccount_code
                const { error: updateError } = await supabaseAdmin
                  .from("profiles")
                  .update({ subaccount_code: subaccountCode })
                  .eq("id", user.id);

                if (updateError) {
                  console.error("❌ Failed to update profile with subaccount_code:", updateError);
                  // Note: Subaccount was created but not saved - this is a critical error
                } else {
                  console.log("✅ Paystack subaccount created and saved:", subaccountCode);
                }
              } else {
                console.error("❌ Invalid response from Paystack:", paystackData);
              }
            } else {
              const errorData = await paystackResponse.json().catch(() => ({}));
              console.error("❌ Failed to create Paystack subaccount:", errorData);
              // Don't fail registration if subaccount creation fails - vendor can add it later
              // Registration is still successful
            }
          }
        } catch (subaccountError) {
          console.error("❌ Error creating Paystack subaccount:", subaccountError);
          // Don't fail registration if subaccount creation fails - vendor can add it later
          // Registration is still successful
        }
      } else {
        console.log("ℹ️ Bank details not provided. Subaccount will need to be created later in settings.");
      }
    }

    console.log("✅ User, profile, and (if applicable) vendor created successfully:", {
      id: user.id,
      email,
      role,
    });

    return NextResponse.json(
      { success: true, user: { id: user.id, email, role } },
      { status: 200 }
    );
  } catch (err) {
    console.error("🔥 Register route crashed:", err);
    
    // Safely extract error properties with proper type narrowing
    const errorName = err instanceof Error ? err.name : "Error";
    const errorMessage = err instanceof Error 
      ? err.message 
      : typeof err === "string" 
        ? err 
        : err !== null && typeof err === "object" && "toString" in err && typeof err.toString === "function"
          ? err.toString()
          : "An unexpected error occurred";
    const errorStack = err instanceof Error ? err.stack : undefined;
    
    console.error("🔥 Error name:", errorName);
    console.error("🔥 Error stack:", errorStack);
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        type: errorName,
      },
      { status: 500 }
    );
  }
}
