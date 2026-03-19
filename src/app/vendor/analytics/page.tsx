"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BarChart3, ShieldCheck } from "lucide-react";

type VendorToolRow = {
  tool_name: string;
  status: string;
  expiry_date: string;
};

type BannerEventRow = {
  event_type: "view" | "click" | "conversion";
};

function isToolActive(row: VendorToolRow): boolean {
  const expires = row.expiry_date ? new Date(row.expiry_date).getTime() : 0;
  return expires > Date.now() || row.status === "active";
}

export default function VendorAnalyticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tools, setTools] = useState<VendorToolRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [views, setViews] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [conversions, setConversions] = useState(0);
  const [sales30d, setSales30d] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth.user?.id;
        if (!userId) {
          router.replace("/loginpage");
          return;
        }

        const { data: toolRows } = await supabase
          .from("vendor_purchased_tools")
          .select("tool_name, status, expiry_date")
          .eq("vendor_id", userId);
        if (!isMounted) return;
        setTools((toolRows || []) as VendorToolRow[]);

        const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const { data: events } = await supabase
          .from("sponsored_banner_events")
          .select("event_type")
          .eq("vendor_id", userId)
          .gte("created_at", sinceIso);

        const eventRows = (events || []) as BannerEventRow[];
        if (!isMounted) return;
        setViews(eventRows.filter((e) => e.event_type === "view").length);
        setClicks(eventRows.filter((e) => e.event_type === "click").length);
        setConversions(eventRows.filter((e) => e.event_type === "conversion").length);

        // Best-effort sales: last 30 days paid/completed orders
        try {
          const { data: orders } = await supabase
            .from("orders")
            .select("total_price, status, created_at")
            .eq("vendor_id", userId)
            .gte("created_at", sinceIso)
            .in("status", ["Paid", "Completed", "paid", "completed"]);
          const orderRows = orders || [];
          const total = orderRows.reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0);
          if (isMounted) setSales30d(total);
        } catch (ordersErr) {
          console.warn("VendorAnalyticsPage orders fetch failed (non-fatal):", ordersErr);
          if (isMounted) setSales30d(null);
        }
      } catch (e) {
        console.error("VendorAnalyticsPage load error:", e);
        if (isMounted) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const canAccessAnalytics = useMemo(() => {
    const active = new Set(tools.filter((t) => isToolActive(t)).map((t) => t.tool_name));
    return active.has("Analytical Marketing");
  }, [tools]);

  if (loading) {
    return (
      <div className="w-full min-h-[240px] flex items-center justify-center bg-hospineil-base-bg rounded-2xl">
        <Loader2 className="h-8 w-8 animate-spin text-hospineil-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-hospineil-light-bg rounded-2xl border border-gray-200">
        <CardHeader>
          <CardTitle className="font-header text-hospineil-primary">Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 font-body">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!canAccessAnalytics) {
    return (
      <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200">
        <CardHeader>
          <CardTitle className="font-header text-2xl text-hospineil-primary flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 font-body">
            Analytical Marketing is required to view analytics.
          </p>
          <div className="mt-4">
            <Button
              className="bg-hospineil-primary text-white font-button rounded-full"
              onClick={() => router.push("/vendor/subscription")}
            >
              Activate Analytical Marketing
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const ctr = views > 0 ? (clicks / views) * 100 : 0;

  // Very lightweight ROI approximation (no direct attribution): sales30d / clicks
  const roi = clicks > 0 && sales30d != null ? sales30d / clicks : null;

  return (
    <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200">
      <CardHeader>
        <CardTitle className="font-header text-2xl text-hospineil-primary flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Promotions Analytics (Last 30 Days)
        </CardTitle>
        <p className="text-gray-600 font-body mt-2">
          Based on tracked sponsored banner views and clicks. Conversions are currently click-level.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-hospineil-base-bg rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-600 font-body">Views</p>
            <p className="text-3xl font-bold text-hospineil-primary font-header">{views}</p>
          </div>
          <div className="bg-hospineil-base-bg rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-600 font-body">Clicks</p>
            <p className="text-3xl font-bold text-hospineil-primary font-header">{clicks}</p>
          </div>
          <div className="bg-hospineil-base-bg rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-600 font-body">CTR</p>
            <p className="text-3xl font-bold text-hospineil-primary font-header">{ctr.toFixed(1)}%</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <p className="text-sm text-gray-600 font-body">Sales (approx.)</p>
              <p className="text-xl font-bold text-gray-900 font-header">
                {sales30d == null ? "Not available" : `₦${sales30d.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 font-body">ROI per click (approx.)</p>
              <p className="text-lg font-semibold text-gray-900 font-header">
                {roi == null ? "—" : `₦${roi.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

