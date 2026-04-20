"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Sparkles, CalendarClock } from "lucide-react";
import Link from "next/link";

export interface VendorPurchasedToolRow {
  id: string;
  tool_name: string;
  status: string;
  purchase_date: string;
  expiry_date: string;
}

function isValidUuid(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isToolActive(expiryIso: string): boolean {
  return new Date(expiryIso).getTime() > Date.now();
}

interface VendorPremiumToolsSectionProps {
  vendorId: string | null | undefined;
  className?: string;
}

export function VendorPremiumToolsSection({
  vendorId,
  className = "",
}: VendorPremiumToolsSectionProps) {
  const [tools, setTools] = useState<VendorPurchasedToolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTools = useCallback(async () => {
    if (!isValidUuid(vendorId)) {
      setTools([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await fetch("/api/vendor-tools/reconcile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || ""}`,
          },
          body: JSON.stringify({ userId: vendorId }),
        });
      } catch (_) {
        // Reconcile is best-effort; continue loading tools
      }

      const { data, error: fetchError } = await supabase
        .from("vendor_purchased_tools")
        .select("id, tool_name, status, purchase_date, expiry_date")
        .eq("vendor_id", vendorId)
        .order("expiry_date", { ascending: false });

      if (fetchError) {
        console.error("Vendor premium tools fetch error:", fetchError);
        setError(fetchError.message || "Could not load premium tools");
        setTools([]);
        return;
      }

      setTools((data as VendorPurchasedToolRow[]) || []);
    } catch (e) {
      console.error("Vendor premium tools exception:", e);
      setError(e instanceof Error ? e.message : "Something went wrong");
      setTools([]);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    void loadTools();
  }, [loadTools]);

  if (!isValidUuid(vendorId)) {
    return null;
  }

  return (
    <Card
      className={`bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200 ${className}`}
    >
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-hospineil-primary/10 text-hospineil-primary">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <CardTitle className="text-xl font-header text-hospineil-primary">
              Premium tools
            </CardTitle>
            <p className="text-sm text-gray-600 font-body mt-0.5">
              Add-ons you&apos;ve purchased for extra visibility and marketing
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="font-button shrink-0" asChild>
          <Link href="/vendor/subscription">Browse tools</Link>
        </Button>
      </CardHeader>
      <CardContent className="pt-2">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin text-hospineil-primary" />
            <span className="font-body text-sm">Loading your tools…</span>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 font-body">
            <p className="font-medium mb-1">Couldn&apos;t load premium tools</p>
            <p className="text-amber-800/90 mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void loadTools()}>
              Try again
            </Button>
          </div>
        ) : tools.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-hospineil-base-bg/80 px-6 py-10 text-center">
            <CalendarClock className="h-10 w-10 mx-auto text-gray-400 mb-3" aria-hidden />
            <p className="text-gray-700 font-body font-medium mb-1">No active tools yet</p>
            <p className="text-sm text-gray-500 font-body mb-4 max-w-md mx-auto">
              Featured placement, location boost, banners, and more — activate optional tools from
              your subscription page when you&apos;re ready.
            </p>
            <Button className="bg-hospineil-primary text-white font-button" asChild>
              <Link href="/vendor/subscription">Explore premium tools</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {tools.map((tool) => {
              const active = isToolActive(tool.expiry_date);
              return (
                <li
                  key={tool.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-gray-100 bg-hospineil-base-bg px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 font-header truncate">
                      {tool.tool_name}
                    </p>
                    <p className="text-xs text-gray-500 font-body mt-1">
                      Purchased{" "}
                      {new Date(tool.purchase_date).toLocaleDateString(undefined, {
                        dateStyle: "medium",
                      })}
                    </p>
                  </div>
                  <div className="flex flex-col sm:items-end gap-1 shrink-0">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold font-button w-fit ${
                        active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {active ? "Active" : "Expired"}
                    </span>
                    <span className="text-xs text-gray-600 font-body">
                      Expires{" "}
                      {new Date(tool.expiry_date).toLocaleDateString(undefined, {
                        dateStyle: "medium",
                      })}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
