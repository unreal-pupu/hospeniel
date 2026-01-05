"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FiCheck } from "react-icons/fi";

interface Plan {
  name: string;
  monthlyPrice?: number;
  yearlyPrice?: number;
  description: string;
  features: string[];
  isFeatured?: boolean;
  isFreeTrial?: boolean;
}

const plans: Plan[] = [
  {
    name: "Free Trial",
    description: "The platform is free for the first six months",
    isFreeTrial: true,
    features: [
      "Platform access for 6 months",
      "Limited Starter features",
      "Perfect for testing the platform",
    ],
  },
  {
    name: "Starter Plan",
    monthlyPrice: 12000,
    yearlyPrice: 136800,
    description: "Perfect for small businesses getting started",
    features: [
      "Upload up to 10 menu items",
      "Priority support",
      "Featured on Explore page",
      "24/7 support",
    ],
  },
  {
    name: "Professional Plan",
    monthlyPrice: 20000,
    yearlyPrice: 228000,
    description: "Ideal for growing businesses",
    isFeatured: true,
    features: [
      "Unlimited product listings",
      "Featured on both Explore and Landing page",
      "Early access to new tools",
      "Marketing campaign integration",
      "Direct contact from users",
    ],
  },
];

export default function Pricing() {
  const [isYearly, setIsYearly] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <section id="pricing" className="py-16 px-6 bg-hospineil-base-bg">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-header italic tracking-wide capitalize mb-4">
            Plans available for every budget.
          </h2>
          <p className="text-lg text-gray-800 font-body mb-8">
            Choose the plan that fits your business needs. Start with a free 6-month trial, then upgrade when you're ready.
          </p>

          {/* Toggle Button */}
          <div className="flex items-center justify-center gap-4">
            <span
              className={`text-sm font-medium font-body ${
                !isYearly ? "text-gray-800" : "text-gray-500"
              }`}
            >
              Monthly
            </span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-hospineil-primary focus:ring-offset-2 ${
                isYearly ? "bg-hospineil-primary" : "bg-gray-300"
              }`}
              aria-label="Toggle billing period"
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  isYearly ? "translate-x-9" : "translate-x-1"
                }`}
              />
            </button>
            <span
              className={`text-sm font-medium font-body ${
                isYearly ? "text-gray-800" : "text-gray-500"
              }`}
            >
              Yearly
            </span>
            {isYearly && (
              <span className="ml-2 px-3 py-1 bg-hospineil-primary/20 text-hospineil-primary text-xs font-semibold rounded-full font-body">
                5% OFF
              </span>
            )}
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mt-12">
          {plans.map((plan, index) => {
            const price = plan.isFreeTrial ? 0 : (isYearly ? plan.yearlyPrice : plan.monthlyPrice);
            const priceLabel = plan.isFreeTrial ? "" : (isYearly ? "year" : "month");
            
            // Determine card and button colors based on index
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
                key={index}
                className={`relative rounded-2xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-105 ${cardBg} border-2 border-transparent`}
              >
                {plan.isFeatured && (
                  <div className="absolute top-0 right-0 bg-white/20 backdrop-blur-sm text-white px-4 py-1 text-xs font-semibold rounded-bl-lg font-body">
                    POPULAR
                  </div>
                )}
                {plan.isFreeTrial && (
                  <div className="absolute top-0 right-0 bg-white/20 backdrop-blur-sm text-white px-4 py-1 text-xs font-semibold rounded-bl-lg font-body">
                    FREE
                  </div>
                )}

                <div className="p-8">
                  {/* Plan Name */}
                  <h3 className={`text-2xl font-bold mb-2 font-header ${textColor}`}>
                    {plan.name}
                  </h3>

                  {/* Description */}
                  <p className={`text-sm mb-6 font-body ${textColor === "text-white" ? "text-white/90" : "text-gray-700"}`}>
                    {plan.description}
                  </p>

                  {/* Price */}
                  <div className="mb-6">
                    {plan.isFreeTrial ? (
                      <span className={`text-4xl font-bold font-header ${textColor}`}>
                        FREE
                      </span>
                    ) : (
                      <>
                        <span className={`text-4xl font-bold font-header ${textColor}`}>
                          {formatPrice(price || 0)}
                        </span>
                        <span className={`text-sm ml-2 font-body ${textColor === "text-white" ? "text-white/80" : "text-gray-600"}`}>
                          /{priceLabel}
                        </span>
                      </>
                    )}
                  </div>

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
                  <Link href="/register" className="block">
                    <Button
                      className={`w-full rounded-full py-3 font-button font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg focus:ring-2 focus:ring-hospineil-primary focus:ring-offset-2 ${buttonBg} ${buttonText} ${buttonHover}`}
                    >
                      {plan.isFreeTrial ? "Start Free Trial" : plan.isFeatured ? "Subscribe Now" : "Get Started"}
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

