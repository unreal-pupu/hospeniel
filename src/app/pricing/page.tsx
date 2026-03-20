"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  CheckCircle2,
  MapPin,
  Megaphone,
  ShieldCheck,
  Star,
  Upload,
} from "lucide-react";

export default function Pricing() {
  return (
    <section id="pricing" className="py-16 px-6 bg-hospineil-base-bg">
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Hero */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-5">
            <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-hospineil-primary/10 text-hospineil-primary text-xs font-semibold font-body">
              Built for food vendors and makers
            </p>
            <h1 className="text-4xl md:text-5xl font-bold font-header text-gray-900 leading-tight">
              Sell your food and more on Hospeniel
            </h1>
            <p className="text-gray-700 text-lg font-body">
              Join our wide community of food vendors, chefs, home cook, bakers and pastry sellers reaching new customers everyday.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                asChild
                className="rounded-full bg-hospineil-primary text-hospineil-light-bg font-button hover:bg-hospineil-primary/90 transition-all"
              >
                <Link href="/register">Become a listed vendor</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-full border-hospineil-primary/30 text-hospineil-primary font-button hover:bg-hospineil-primary/10 transition-all"
              >
                <Link href="/register">Learn about premium tools</Link>
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-hospineil-primary/15 to-hospineil-accent/10 blur-2xl rounded-3xl" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/DORCAS.jpg"
              alt="Hospeniel vendor"
              className="relative rounded-3xl w-full h-[380px] object-cover shadow-lg transition-transform duration-300 hover:scale-[1.01]"
            />
          </div>
        </section>

        {/* Why Sell */}
        <section className="space-y-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-header font-bold text-gray-900">
              Why sell on Hospeniel?
            </h2>
          </div>

          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <li className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white/70 p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div className="space-y-1">
                <p className="font-semibold text-gray-900 font-body">
                  Free to list your food items
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white/70 p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-hospineil-primary/10 text-hospineil-primary shrink-0">
                <Upload className="h-5 w-5" />
              </span>
              <div className="space-y-1">
                <p className="font-semibold text-gray-900 font-body">
                  Upload unlimited menu items
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white/70 p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700 shrink-0">
                <MapPin className="h-5 w-5" />
              </span>
              <div className="space-y-1">
                <p className="font-semibold text-gray-900 font-body">
                  Reach customers near you
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white/70 p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div className="space-y-1">
                <p className="font-semibold text-gray-900 font-body">
                  Secure payments by Paystack
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white/70 p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 md:col-span-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 shrink-0">
                <Megaphone className="h-5 w-5" />
              </span>
              <div className="space-y-1">
                <p className="font-semibold text-gray-900 font-body">
                  Optional tools to boost your visibility
                </p>
              </div>
            </li>
          </ul>
        </section>

        {/* Premium Tools */}
        <section className="space-y-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-header font-bold text-gray-900">
              Boost your sales with optional premium tools
            </h2>
            <p className="text-gray-700 font-body">
              Stand out and reach more customers!
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                title: "Featured Placement",
                description:
                  "Appear at the top of home page and explore pages for maximum visibility.",
                icon: Star,
              },
              {
                title: "Priority Location Boost",
                description:
                  "Top listing when customers use the filter by location (your exact location).",
                icon: MapPin,
              },
              {
                title: "Sponsored Banners",
                description:
                  "Highlight your offers with homepage promotional banners.",
                icon: Megaphone,
              },
              {
                title: "Analytical Marketing",
                description:
                  "View sales trends and customer insights to understand how your products perform.",
                icon: BarChart3,
              },
            ].map(({ title, description, icon: Icon }) => (
              <Card
                key={title}
                className="border-2 border-transparent rounded-2xl shadow-md overflow-hidden bg-hospineil-light-bg hover:shadow-xl transition-all duration-300"
              >
                <CardContent className="p-5 space-y-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-hospineil-primary/10 text-hospineil-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-base font-semibold text-gray-900 font-body">
                    {title}
                  </h3>
                  <p className="text-sm text-gray-600 font-body">
                    {description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="pt-2">
            <Button asChild variant="link" className="px-0 text-hospineil-primary hover:underline font-button">
              <Link href="/register">Learn more about Premium tools</Link>
            </Button>
          </div>
        </section>
      </div>
    </section>
  );
}

