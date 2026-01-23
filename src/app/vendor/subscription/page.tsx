"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { loadPaystackScript, getAuthenticatedUserEmail } from "@/lib/paystack";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  Crown,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { FiCheck } from "react-icons/fi";

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

export default function SubscriptionPage() {
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState<string>("free_trial");
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [planBillingPeriod, setPlanBillingPeriod] = useState<Record<string, boolean>>({});

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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Subscription Plans</h1>
        <p className="text-gray-600">
          Choose the plan that best fits your business needs
        </p>
      </div>

      {/* Current Plan Badge */}
      <div className="mb-6">
        <Badge variant="outline" className="text-sm px-4 py-2">
          Current Plan: <span className="font-semibold capitalize ml-1">{currentPlan.replace("_", " ")}</span>
        </Badge>
      </div>

      {/* Plans Grid */}
      <div className="grid md:grid-cols-3 gap-8">
        {PLANS.map((plan, index) => {
          const status = getPlanStatus(plan.value);
          const isCurrent = plan.value === currentPlan;
          const displayPrice = getDisplayPrice(plan);
          const isYearly = planBillingPeriod[plan.value] || false;

          // Determine card and button colors based on index (matching Pricing component)
          let cardBg, textColor, buttonBg, buttonText, buttonHover;
          if (index === 0) {
            // First card: Teal background, Orange button
            cardBg = "bg-hospineil-primary";
            textColor = "text-white";
            buttonBg = "bg-hospineil-accent";
            buttonText = "text-hospineil-light-bg";
            buttonHover = "hover:bg-hospineil-accent-hover";
          } else if (index === 1) {
            // Middle card: Light background, Teal button
            cardBg = "bg-hospineil-light-bg";
            textColor = "text-gray-800";
            buttonBg = "bg-hospineil-primary";
            buttonText = "text-hospineil-light-bg";
            buttonHover = "hover:bg-hospineil-primary/90";
          } else {
            // Last card: Orange background, Light button
            cardBg = "bg-hospineil-accent";
            textColor = "text-white";
            buttonBg = "bg-hospineil-light-bg";
            buttonText = "text-hospineil-primary";
            buttonHover = "hover:bg-hospineil-light-bg/90";
          }

          return (
            <div
              key={plan.value}
              className={`relative rounded-2xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-105 ${cardBg} border-2 border-transparent`}
            >
              {plan.isRecommended && (
                <div className="absolute top-0 right-0 bg-white/20 backdrop-blur-sm text-white px-4 py-1 text-xs font-semibold rounded-bl-lg font-body">
                  POPULAR
                </div>
              )}
              {plan.value === "free_trial" && (
                <div className="absolute top-0 right-0 bg-white/20 backdrop-blur-sm text-white px-4 py-1 text-xs font-semibold rounded-bl-lg font-body">
                  FREE
                </div>
              )}

              <div className="p-8">
                {/* Plan Name */}
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`text-2xl font-bold font-header ${textColor}`}>
                    {plan.name}
                  </h3>
                  {isCurrent && (
                    <CheckCircle className={`h-6 w-6 ${textColor === "text-white" ? "text-white" : "text-green-600"}`} />
                  )}
                </div>

                {/* Description */}
                <p className={`text-sm mb-4 font-body ${textColor === "text-white" ? "text-white/90" : "text-gray-700"}`}>
                  {plan.description}
                </p>

                {/* Price and Billing Toggle */}
                <div className="mb-6">
                  {plan.price === 0 ? (
                    <span className={`text-4xl font-bold font-header ${textColor}`}>
                      FREE
                    </span>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-4xl font-bold font-header ${textColor}`}>
                          {formatPrice(displayPrice.price)}
                        </span>
                        <span className={`text-sm font-body ${textColor === "text-white" ? "text-white/80" : "text-gray-600"}`}>
                          /{displayPrice.label}
                        </span>
                      </div>
                      {/* Billing Period Toggle */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleBillingPeriod(plan.value)}
                          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                            isYearly 
                              ? textColor === "text-white" ? "bg-white/30" : "bg-hospineil-primary" 
                              : textColor === "text-white" ? "bg-white/20" : "bg-gray-300"
                          } ${textColor === "text-white" ? "focus:ring-white" : "focus:ring-hospineil-primary"}`}
                          aria-label="Toggle billing period"
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                              isYearly ? "translate-x-8" : "translate-x-1"
                            }`}
                          />
                        </button>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-body ${!isYearly ? (textColor === "text-white" ? "text-white" : "text-gray-800") : (textColor === "text-white" ? "text-white/60" : "text-gray-500")}`}>
                            Monthly
                          </span>
                          <span className={`text-xs font-body ${isYearly ? (textColor === "text-white" ? "text-white" : "text-gray-800") : (textColor === "text-white" ? "text-white/60" : "text-gray-500")}`}>
                            Yearly
                          </span>
                          {isYearly && (
                            <span className={`ml-1 px-2 py-0.5 text-xs font-semibold rounded-full font-body ${
                              textColor === "text-white" 
                                ? "bg-white/20 text-white" 
                                : "bg-hospineil-primary/20 text-hospineil-primary"
                            }`}>
                              10% OFF
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                {!isCurrent && (
                  <Badge className={`mb-4 ${status.color} font-body`}>
                    {status.label}
                  </Badge>
                )}

                {/* Features List */}
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li
                      key={featureIndex}
                      className="flex items-start gap-3"
                    >
                      <FiCheck
                        className={`flex-shrink-0 w-5 h-5 mt-0.5 ${textColor === "text-white" ? "text-white" : "text-hospineil-accent"}`}
                      />
                      <span className={`text-sm font-body ${textColor === "text-white" ? "text-white/90" : "text-gray-800"}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button
                  onClick={() => handleUpgrade(plan.value)}
                  disabled={isCurrent || upgrading === plan.value}
                  className={`w-full rounded-full py-3 font-button font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg focus:ring-2 focus:ring-hospineil-primary focus:ring-offset-2 ${
                    isCurrent
                      ? "bg-gray-300 text-gray-600 cursor-not-allowed hover:scale-100"
                      : `${buttonBg} ${buttonText} ${buttonHover}`
                  }`}
                >
                  {upgrading === plan.value ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : isCurrent ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Current Plan
                    </>
                  ) : (
                    <>
                      <Crown className="mr-2 h-4 w-4" />
                      {status.label}
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Section */}
      <Card className="mt-8 bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">
                Subscription Information
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Free trial lasts 30 days from account creation</li>
                <li>• All plans include 10% commission on sales</li>
                <li>• Professional plan enables direct contact from users</li>
                <li>• You can upgrade or downgrade at any time</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

