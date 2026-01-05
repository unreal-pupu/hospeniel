"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { loadPaystackScript, getAuthenticatedUserEmail } from "@/lib/paystack";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  Crown,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";

interface SubscriptionPlan {
  name: string;
  value: string;
  price: number;
  features: string[];
  isCurrent?: boolean;
  isRecommended?: boolean;
}

const PLANS: SubscriptionPlan[] = [
  {
    name: "Free Trial",
    value: "free_trial",
    price: 0,
    features: [
      "5 menu items",
      "Platform access for 6 months",
      "Basic features",
    ],
  },
  {
    name: "Starter Plan",
    value: "starter",
    price: 12000,
    features: [
      "10 menu items",
      "Priority support",
      "Featured on Explore page",
      "24/7 support",
    ],
  },
  {
    name: "Professional Plan",
    value: "professional",
    price: 20000,
    features: [
      "Unlimited menu items",
      "Featured on Explore and Landing page",
      "Early access to new tools",
      "Marketing campaign integration",
      "Direct contact from users",
      "Service requests enabled",
    ],
    isRecommended: true,
  },
];

export default function SubscriptionPage() {
  const router = useRouter();
  const [currentPlan, setCurrentPlan] = useState<string>("free_trial");
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    fetchCurrentPlan();
  }, []);

  const fetchCurrentPlan = async () => {
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
  };

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

      console.log(`🔄 Upgrading subscription to: ${planValue}`);
      console.log(`🔄 Current plan: ${currentPlan}`);
      console.log(`🔄 User ID: ${user.id}`);
      console.log(`🔄 Plan price: ₦${selectedPlan.price}`);

      // If it's a free plan (free_trial or downgrade), update directly without payment
      if (selectedPlan.price === 0) {
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
      } catch (scriptError: any) {
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
        amount: selectedPlan.price * 100, // Convert to kobo (Paystack uses kobo)
        currency: "NGN",
        ref: paymentReference,
        callback: function(response: { reference: string; status: string; transaction?: string }) {
          console.log("✅ Payment callback triggered:", response);
          
          if (response.status === "success") {
            // Payment successful - update subscription via API (async, fire and forget)
            updateSubscriptionAfterPayment(callbackUserId, callbackPlanValue, response.reference).catch((error: any) => {
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
    } catch (error: any) {
      console.error("❌ Error in upgrade flow:", error);
      alert(`An error occurred: ${error.message || "Please try again."}`);
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
    } catch (error: any) {
      console.error("❌ Error updating subscription:", error);
      alert(`Failed to update subscription: ${error.message || "Please try again."}`);
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
    } catch (error: any) {
      console.error("❌ Error updating subscription after payment:", error);
      alert(`Payment was successful, but subscription update failed: ${error.message || "Please contact support."}`);
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
      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const status = getPlanStatus(plan.value);
          const isCurrent = plan.value === currentPlan;

          return (
            <Card
              key={plan.value}
              className={`relative rounded-xl shadow-lg transition-all hover:shadow-xl ${
                plan.isRecommended
                  ? "border-2 border-indigo-600 bg-indigo-50/30"
                  : "border border-gray-200"
              }`}
            >
              {plan.isRecommended && (
                <div className="absolute -top-3 right-4 bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                  RECOMMENDED
                </div>
              )}

              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <CardTitle className="text-2xl font-bold text-gray-900">
                    {plan.name}
                  </CardTitle>
                  {isCurrent && (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900">
                    ₦{plan.price.toLocaleString("en-NG")}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-gray-500 text-sm">/month</span>
                  )}
                </div>
                <Badge className={`mt-2 ${status.color}`}>
                  {status.label}
                </Badge>
              </CardHeader>

              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleUpgrade(plan.value)}
                  disabled={isCurrent || upgrading === plan.value}
                  className={`w-full ${
                    plan.isRecommended
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                      : isCurrent
                      ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                      : "bg-gray-900 hover:bg-gray-800 text-white"
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
              </CardContent>
            </Card>
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
                <li>• Free trial lasts 6 months from account creation</li>
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

