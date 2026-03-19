"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { loadPaystackScript, getAuthenticatedUserEmail } from "@/lib/paystack";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Star,
  MapPin,
  Megaphone,
  BadgeCheck,
  Share2,
  BarChart3,
} from "lucide-react";
import { getExpectedToolPriceKobo, type VendorToolBilling } from "@/lib/vendor-premium-tools-catalog";

interface SubscriptionPlan {
  name: string;
  value: string;
  description: string;
  price: number;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  isCurrent?: boolean;
  isRecommended?: boolean;
}

const PLANS: SubscriptionPlan[] = [
  {
    name: "Free Trial",
    value: "free_trial",
    description: "Every new vendor gets 30 days of free access to the platform.",
    price: 0,
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      "Get listed on the marketplace",
      "Upload up to 3 menu items",
      "Basic vendor dashboard",
      "Receive customer orders",
      "24/7 support",
    ],
  },
  {
    name: "Starter Plan",
    value: "starter",
    description: "Best for growing vendors",
    price: 10000,
    monthlyPrice: 10000,
    yearlyPrice: 108000, // 10000 * 12 * 0.90 (10% discount)
    features: [
      "Priority listing and discovery",
      "Upload and manage up to 10 menu items",
      "Priority support",
      "Featured on Explore page",
      "24/7 support",
    ],
  },
  {
    name: "Premium",
    value: "professional",
    description: "For vendors ready to scale",
    price: 20000,
    monthlyPrice: 20000,
    yearlyPrice: 216000, // 20000 * 12 * 0.90 (10% discount)
    features: [
      "Priority placement on Explore and Home page",
      "Upload unlimited menu items",
      "Receive and reply to service requests",
      "Customer chat access",
      "Higher service request visibility",
      "Premium vendor credibility",
      "24/7 support",
    ],
    isRecommended: true,
  },
];

const PREMIUM_TOOLS = [
  {
    title: "Featured Placement",
    description: "Appear at the top of home page and explore pages for maximum visibility.",
    icon: Star,
  },
  {
    title: "Priority Location Boost",
    description: "Top listing when customers use the filter by location (your exact location).",
    icon: MapPin,
  },
  {
    title: "Sponsored Banners",
    description: "Highlight your offers with homepage promotional banners.",
    icon: Megaphone,
  },
  {
    title: "Analytical Marketing",
    description: "View sales trends and customer insights to understand how your products perform.",
    icon: BarChart3,
  },
];

export default function SubscriptionPage() {
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState<string>("free_trial");
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [planBillingPeriod, setPlanBillingPeriod] = useState<Record<string, boolean>>({});
  const [isYearlyPricing, setIsYearlyPricing] = useState(false);
  const [toolCheckout, setToolCheckout] = useState<string | null>(null);

  const fetchCurrentPlan = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/loginpage");
        return;
      }

      // Fetch subscription plan from profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_plan, is_premium")
        .eq("id", user.id)
        .single();

      if (profile) {
        setCurrentPlan(profile.subscription_plan || "free_trial");
      }
    } catch (error) {
      console.error("Error fetching subscription plan:", error);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchCurrentPlan();
  }, [fetchCurrentPlan]);

  const handleUpgrade = async (planValue: string) => {
    if (planValue === currentPlan) {
      alert("You are already on this plan.");
      return;
    }

    // Check if downgrading
    const planOrder = { free_trial: 0, starter: 1, professional: 2 };
    if (planOrder[planValue as keyof typeof planOrder] < planOrder[currentPlan as keyof typeof planOrder]) {
      if (!confirm("Are you sure you want to downgrade? You may lose access to some features.")) {
        return;
      }
    }

    setUpgrading(planValue);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Please log in to upgrade your subscription.");
        setUpgrading(null);
        return;
      }

      const selectedPlan = PLANS.find(p => p.value === planValue);
      if (!selectedPlan) {
        alert("Invalid subscription plan selected.");
        setUpgrading(null);
        return;
      }

      // Get the selected billing period for this plan
      const isYearly = planBillingPeriod[planValue] || false;
      const planPrice = isYearly ? selectedPlan.yearlyPrice : selectedPlan.monthlyPrice;

      console.log(`🔄 Upgrading subscription to: ${planValue}`);
      console.log(`🔄 Current plan: ${currentPlan}`);
      console.log(`🔄 User ID: ${user.id}`);
      console.log(`🔄 Billing period: ${isYearly ? "Yearly" : "Monthly"}`);
      console.log(`🔄 Plan price: ₦${planPrice}`);

      // If it's a free plan (free_trial or downgrade), update directly without payment
      if (planPrice === 0) {
        console.log("ℹ️ Free plan selected, updating directly without payment...");
        await updateSubscriptionDirectly(user.id, planValue);
        setUpgrading(null);
        return;
      }

      // For paid plans, initiate Paystack payment
      console.log("💳 Initiating Paystack payment...");
      
      // Validate Paystack public key
      const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
      if (!paystackPublicKey) {
        console.error("❌ Paystack public key not configured");
        alert("Payment system is not configured. Please contact support.");
        setUpgrading(null);
        return;
      }
      
      // Get user email
      const userEmail = user.email || await getAuthenticatedUserEmail();
      if (!userEmail) {
        alert("Unable to get your email address. Please try again.");
        setUpgrading(null);
        return;
      }

      // Load Paystack script
      try {
        await loadPaystackScript();
      } catch (scriptError) {
        console.error("❌ Failed to load Paystack script:", scriptError);
        alert("Failed to load payment system. Please refresh the page and try again.");
        setUpgrading(null);
        return;
      }

      // Generate payment reference
      const paymentReference = `sub_${user.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Initialize Paystack payment
      if (!window.PaystackPop || typeof window.PaystackPop.setup !== "function") {
        alert("Payment system not ready. Please refresh the page and try again.");
        setUpgrading(null);
        return;
      }

      // Store values in closure for callback (Paystack callback must be synchronous)
      const callbackUserId = user.id;
      const callbackPlanValue = planValue;

      // Use regular function (not arrow/async) for Paystack callback
      const handler = window.PaystackPop.setup({
        key: paystackPublicKey,
        email: userEmail,
        amount: planPrice * 100, // Convert to kobo (Paystack uses kobo)
        currency: "NGN",
        ref: paymentReference,
        callback: function(response: { reference: string; status: string; transaction?: string }) {
          console.log("✅ Payment callback triggered:", response);
          
          if (response.status === "success") {
            // Payment successful - update subscription via API (async, fire and forget)
            updateSubscriptionAfterPayment(callbackUserId, callbackPlanValue, response.reference).catch((error) => {
              console.error("❌ Error updating subscription after payment:", error);
              alert("Payment was successful, but there was an error updating your subscription. Please contact support with reference: " + response.reference);
            });
          } else {
            console.warn("⚠️ Payment not successful:", response);
            alert("Payment was not completed successfully. Please try again.");
            setUpgrading(null);
          }
        },
        onClose: function() {
          console.log("⚠️ Payment window closed by user");
          setUpgrading(null);
        },
      });

      // Validate handler before opening
      if (!handler || typeof handler.openIframe !== "function") {
        alert("Unable to open payment window. Please refresh the page and try again.");
        setUpgrading(null);
        return;
      }

      handler.openIframe();
    } catch (error) {
      console.error("❌ Error in upgrade flow:", error);
      const errorMessage = error instanceof Error ? error.message : "Please try again.";
      alert(`An error occurred: ${errorMessage}`);
      setUpgrading(null);
    }
  };

  const activatePremiumToolAfterPayment = async (
    userId: string,
    paymentReference: string,
    toolTitle: string
  ) => {
    const maxAttempts = 8;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const statusResponse = await fetch("/api/vendor-tools/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, paymentReference, toolName: toolTitle }),
      });
      const statusData = await statusResponse.json();
      if (statusResponse.ok && statusData?.success) {
        const isActive = Boolean(statusData.data?.featureActive);
        if (isActive) {
          alert(`Payment successful! ${toolTitle} is now active on your dashboard.`);
          return;
        }
      }

      // Fallback verifier (not primary path): reconcile payment if webhook is delayed/failed
      const fallbackResponse = await fetch("/api/vendor-tools/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, paymentReference }),
      });
      const fallbackData = await fallbackResponse.json();
      if (fallbackResponse.ok && fallbackData?.success) {
        const already = fallbackData.alreadyActivated ? " (already recorded)" : "";
        alert(`Payment successful! ${toolTitle} is now active${already}.`);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error("Payment confirmed but activation is still pending reconciliation.");
  };

  const handleToolCheckout = async (
    toolTitle: string,
    billing: VendorToolBilling
  ) => {
    setToolCheckout(toolTitle);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Please log in to activate a premium tool.");
        setToolCheckout(null);
        return;
      }

      const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
      if (!paystackPublicKey) {
        console.error("❌ Paystack public key not configured");
        alert("Payment system is not configured. Please contact support.");
        setToolCheckout(null);
        return;
      }

      const userEmail = user.email || await getAuthenticatedUserEmail();
      if (!userEmail) {
        alert("Unable to get your email address. Please try again.");
        setToolCheckout(null);
        return;
      }

      try {
        await loadPaystackScript();
      } catch (scriptError) {
        console.error("❌ Failed to load Paystack script:", scriptError);
        alert("Failed to load payment system. Please refresh the page and try again.");
        setToolCheckout(null);
        return;
      }

      const initializeResponse = await fetch("/api/vendor-tools/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, toolName: toolTitle, billing }),
      });
      const initializeData = await initializeResponse.json();
      if (!initializeResponse.ok || !initializeData?.success) {
        alert(initializeData?.error || "Could not initialize premium tool payment.");
        setToolCheckout(null);
        return;
      }
      const paymentReference = initializeData.data.paymentReference as string;
      const amountKobo = Number(initializeData.data.amountKobo || 0);
      if (!paymentReference || !amountKobo) {
        alert("Payment initialization returned invalid data.");
        setToolCheckout(null);
        return;
      }

      if (!window.PaystackPop || typeof window.PaystackPop.setup !== "function") {
        alert("Payment system not ready. Please refresh the page and try again.");
        setToolCheckout(null);
        return;
      }

      const callbackUserId = user.id;

      const handler = window.PaystackPop.setup({
        key: paystackPublicKey,
        email: userEmail,
        amount: amountKobo,
        currency: "NGN",
        ref: paymentReference,
        metadata: initializeData.data.metadata,
        callback: function(response: { reference: string; status: string }) {
          if (response.status === "success") {
            alert("Payment successful, activating features...");
            activatePremiumToolAfterPayment(callbackUserId, response.reference, toolTitle).catch(
              (err) => {
                console.error("Premium tool activation error:", err);
                alert(
                  `Payment succeeded but activation failed: ${err instanceof Error ? err.message : "Unknown error"}. Please contact support with reference: ${response.reference}`
                );
              }
            );
          } else {
            alert("Payment was not completed successfully. Please try again.");
          }
          setToolCheckout(null);
        },
        onClose: function() {
          setToolCheckout(null);
        },
      });

      if (!handler || typeof handler.openIframe !== "function") {
        alert("Unable to open payment window. Please refresh the page and try again.");
        setToolCheckout(null);
        return;
      }

      handler.openIframe();
    } catch (error) {
      console.error("❌ Error in tool checkout:", error);
      const errorMessage = error instanceof Error ? error.message : "Please try again.";
      alert(`An error occurred: ${errorMessage}`);
      setToolCheckout(null);
    }
  };

  const updateSubscriptionDirectly = async (userId: string, planValue: string) => {
    try {
      const response = await fetch("/api/subscription/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          subscriptionPlan: planValue,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to update subscription");
      }

      console.log("✅ Subscription updated successfully:", data.data);
      alert(`Successfully updated to ${PLANS.find(p => p.value === planValue)?.name || planValue}!`);
      
      // Refresh current plan and redirect
      await fetchCurrentPlan();
      setTimeout(() => {
        router.push("/vendor/dashboard");
      }, 1500);
    } catch (error) {
      console.error("❌ Error updating subscription:", error);
      const errorMessage = error instanceof Error ? error.message : "Please try again.";
      alert(`Failed to update subscription: ${errorMessage}`);
      throw error;
    }
  };

  const updateSubscriptionAfterPayment = async (userId: string, planValue: string, paymentReference: string) => {
    try {
      console.log("🔄 Updating subscription after payment...", { userId, planValue, paymentReference });
      
      const response = await fetch("/api/subscription/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          subscriptionPlan: planValue,
          paymentReference,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to update subscription");
      }

      console.log("✅ Subscription updated after payment:", data.data);
      
      // Show success message
      const planName = PLANS.find(p => p.value === planValue)?.name || planValue;
      alert(`Payment successful! Your subscription has been upgraded to ${planName}!`);
      
      // Refresh current plan to update UI
      await fetchCurrentPlan();
      
      // Reset upgrading state
      setUpgrading(null);
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push("/vendor/dashboard");
      }, 1500);
    } catch (error) {
      console.error("❌ Error updating subscription after payment:", error);
      const errorMessage = error instanceof Error ? error.message : "Please contact support.";
      alert(`Payment was successful, but subscription update failed: ${errorMessage}`);
      setUpgrading(null);
      throw error;
    }
  };

  const getPlanStatus = (planValue: string) => {
    if (planValue === currentPlan) {
      return { label: "Current Plan", color: "bg-green-100 text-green-800" };
    }
    const planOrder = { free_trial: 0, starter: 1, professional: 2 };
    if (planOrder[planValue as keyof typeof planOrder] > planOrder[currentPlan as keyof typeof planOrder]) {
      return { label: "Upgrade", color: "bg-indigo-100 text-indigo-800" };
    }
    return { label: "Downgrade", color: "bg-gray-100 text-gray-800" };
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const getToolPrice = (toolTitle: string) => {
    const monthlyKobo = getExpectedToolPriceKobo(toolTitle, "monthly");
    const yearlyKobo = getExpectedToolPriceKobo(toolTitle, "yearly");

    const monthlyNgn = monthlyKobo ? monthlyKobo / 100 : 0;
    const yearlyNgn = yearlyKobo ? yearlyKobo / 100 : 0;

    if (!isYearlyPricing) {
      return {
        price: monthlyNgn,
        label: "month",
        monthlyPrice: monthlyNgn,
        yearlyPrice: yearlyNgn,
        showYearlyDiscountBadge: false,
      };
    }

    return {
      price: yearlyNgn,
      label: "year",
      monthlyPrice: monthlyNgn,
      yearlyPrice: yearlyNgn,
      showYearlyDiscountBadge: true,
    };
  };

  const toggleBillingPeriod = (planValue: string) => {
    setPlanBillingPeriod((prev) => ({
      ...prev,
      [planValue]: !prev[planValue],
    }));
  };

  const getDisplayPrice = (plan: SubscriptionPlan) => {
    if (plan.price === 0) return { price: 0, label: "" };
    const isYearly = planBillingPeriod[plan.value] || false;
    return {
      price: isYearly ? plan.yearlyPrice : plan.monthlyPrice,
      label: isYearly ? "year" : "month",
    };
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-indigo-600 h-8 w-8 mb-4" />
        <p className="text-gray-600">Loading subscription plans...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Boost your sales with optional premium tools
        </h1>
        <p className="text-gray-600">Stand out and reach more customers.</p>
      </div>

      {/* Billing Toggle */}
      <div className="flex items-center gap-3 mb-6">
        <span className={`text-sm font-medium ${!isYearlyPricing ? "text-gray-900" : "text-gray-500"}`}>
          Monthly
        </span>
        <button
          onClick={() => setIsYearlyPricing((prev) => !prev)}
          className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            isYearlyPricing ? "bg-hospineil-primary" : "bg-gray-300"
          }`}
          aria-label="Toggle billing period"
          type="button"
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
              isYearlyPricing ? "translate-x-9" : "translate-x-1"
            }`}
          />
        </button>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${isYearlyPricing ? "text-gray-900" : "text-gray-500"}`}>
            Yearly
          </span>
          {isYearlyPricing && (
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-hospineil-primary/10 text-hospineil-primary">
              10% OFF
            </span>
          )}
        </div>
      </div>

      {/* Premium Tools Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {PREMIUM_TOOLS.map((tool) => {
          const Icon = tool.icon;
          const displayPrice = getToolPrice(tool.title);
          return (
            <Card
              key={tool.title}
              className="border-2 border-transparent rounded-2xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-[1.02] bg-hospineil-light-bg"
            >
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-hospineil-primary/10 text-hospineil-primary">
                    <Icon size={20} />
                  </span>
                  <h3 className="text-lg font-semibold text-gray-900">{tool.title}</h3>
                </div>
                <p className="text-sm text-gray-600">{tool.description}</p>
                <div className="pt-1 space-y-1">
                  <p className="text-xl font-bold text-gray-900">
                    {formatPrice(displayPrice.price)}
                    <span className="text-sm font-medium text-gray-500"> / {displayPrice.label}</span>
                  </p>

                  <div className="text-xs text-gray-600 flex items-center gap-2 flex-wrap">
                    <span>
                      Monthly: {formatPrice(displayPrice.monthlyPrice)} / month
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="flex items-center gap-2">
                      Yearly: {formatPrice(displayPrice.yearlyPrice)} / year
                      {isYearlyPricing && (
                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-hospineil-primary/10 text-hospineil-primary">
                          10% OFF
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                <Button
                  onClick={() =>
                    handleToolCheckout(
                      tool.title,
                      isYearlyPricing ? "yearly" : "monthly"
                    )
                  }
                  className="w-full rounded-full bg-hospineil-primary text-hospineil-light-bg hover:bg-hospineil-primary/90"
                  disabled={toolCheckout === tool.title}
                >
                  {toolCheckout === tool.title ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Activate Tool"
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

