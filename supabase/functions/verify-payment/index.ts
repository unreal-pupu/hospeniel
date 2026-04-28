// supabase/functions/verify-payment/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    const rawSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    const secretKey = rawSecretKey
      ? rawSecretKey.trim().replace(/[\u200B-\u200D\uFEFF]/g, "")
      : "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!secretKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables");
    }

    const authHeader = `Bearer ${secretKey}`;
    console.log("[paystack-auth-debug] supabase/functions/verify-payment", {
      keyExists: typeof rawSecretKey === "string",
      keyIsEmptyAfterTrim: secretKey.length === 0,
      keyLength: secretKey.length,
      maskedKeyPreview:
        secretKey.length > 10
          ? `${secretKey.slice(0, 6)}...${secretKey.slice(-4)}`
          : `${secretKey.slice(0, 2)}***${secretKey.slice(-2)}`,
      keyPrefix: secretKey.startsWith("sk_test_")
        ? "sk_test"
        : secretKey.startsWith("sk_live_")
          ? "sk_live"
          : "unknown",
      authHeaderHasBearerPrefix: authHeader.startsWith("Bearer "),
    });

    const { reference } = await req.json();

    // 1️⃣ Verify payment with Paystack API
    const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: authHeader,
      },
    });
    const verifyData = await res.json();

    if (!verifyData.status || verifyData.data.status !== "success") {
      return new Response(JSON.stringify({ error: "Payment not verified" }), {
        status: 400,
      });
    }

    // 2️⃣ Update Supabase order as paid
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    await supabase
      .from("orders")
      .update({
        status: "paid",
        payment_reference: verifyData.data.reference,
      })
      .eq("payment_reference", reference);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("Webhook Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
