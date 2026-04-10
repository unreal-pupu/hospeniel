"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Store, Bike, Search } from "lucide-react";
import Link from "next/link";

interface VendorMonitorRow {
  profile_id: string;
  name: string | null;
  email: string | null;
  business_name: string | null;
  location: string | null;
  phone_number: string | null;
  is_open: boolean;
  raw_is_open: boolean | null;
  approval_status: string | null;
  subscription_plan: string | null;
  last_order_at: string | null;
  orders_last_7d: number;
  orders_last_14d: number;
  orders_total_30d: number;
  cancelled_orders_30d: number;
  menu_items_created_24h: number;
  flags: string[];
}

interface RiderMonitorRow {
  id: string;
  name: string | null;
  email: string | null;
  phone_number: string | null;
  rider_approval_status: string | null;
  is_available: boolean | null;
  assignments_today: number;
  current_delivery: { label: string; active_task_count: number; sample_order_id: string } | null;
  operational_status: string;
}

const FLAG_LABELS: Record<string, string> = {
  no_orders_14d: "No orders 14d+",
  quiet_7d: "Quiet 7d+",
  high_menu_creation_24h: "High menu churn",
  high_cancellation_rate_30d: "High cancellations",
  duplicate_menu_titles: "Duplicate menu titles",
};

export default function AdminOperationsPage() {
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [loadingRiders, setLoadingRiders] = useState(true);
  const [vendors, setVendors] = useState<VendorMonitorRow[]>([]);
  const [riders, setRiders] = useState<RiderMonitorRow[]>([]);
  const [meta, setMeta] = useState<{ reportDate?: string }>({});

  const [availability, setAvailability] = useState<"all" | "open" | "closed">("all");
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorFlagFilter, setVendorFlagFilter] = useState<"all" | "suspicious" | "inactive">("all");
  const [riderSearch, setRiderSearch] = useState("");

  const fetchVendors = useCallback(async () => {
    try {
      setLoadingVendors(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setVendors([]);
        return;
      }
      const res = await fetch(`/api/admin/operations/vendors?availability=${availability}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        console.error(await res.text());
        setVendors([]);
        return;
      }
      const json = await res.json();
      setVendors(json.vendors || []);
    } catch (e) {
      console.error(e);
      setVendors([]);
    } finally {
      setLoadingVendors(false);
    }
  }, [availability]);

  const fetchRiders = useCallback(async () => {
    try {
      setLoadingRiders(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setRiders([]);
        return;
      }
      const res = await fetch("/api/admin/operations/riders", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        console.error(await res.text());
        setRiders([]);
        return;
      }
      const json = await res.json();
      setRiders(json.riders || []);
      setMeta((m) => ({ ...m, reportDate: json.meta?.reportDate }));
    } catch (e) {
      console.error(e);
      setRiders([]);
    } finally {
      setLoadingRiders(false);
    }
  }, []);

  useEffect(() => {
    void fetchVendors();
  }, [fetchVendors]);

  useEffect(() => {
    void fetchRiders();
    const id = setInterval(() => void fetchRiders(), 30000);
    return () => clearInterval(id);
  }, [fetchRiders]);

  const filteredVendors = useMemo(() => {
    let rows = vendors;
    const q = vendorSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (v) =>
          v.name?.toLowerCase().includes(q) ||
          v.email?.toLowerCase().includes(q) ||
          v.business_name?.toLowerCase().includes(q) ||
          v.profile_id.toLowerCase().includes(q)
      );
    }
    if (vendorFlagFilter === "suspicious") {
      const suspiciousKeys = new Set([
        "high_menu_creation_24h",
        "high_cancellation_rate_30d",
        "duplicate_menu_titles",
      ]);
      rows = rows.filter((v) => v.flags.some((f) => suspiciousKeys.has(f)));
    } else if (vendorFlagFilter === "inactive") {
      rows = rows.filter((v) => v.flags.includes("no_orders_14d"));
    }
    return rows;
  }, [vendors, vendorSearch, vendorFlagFilter]);

  const filteredRiders = useMemo(() => {
    const q = riderSearch.trim().toLowerCase();
    if (!q) return riders;
    return riders.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.phone_number?.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
    );
  }, [riders, riderSearch]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 font-header">Operations &amp; monitoring</h1>
        <p className="text-gray-600 mt-2 font-body max-w-3xl">
          Vendor availability, activity signals, and rider workload. All filters use live API data (
          {meta.reportDate ? `rider “today”: ${meta.reportDate} (Africa/Lagos)` : "Africa/Lagos calendar"}).
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2 font-header text-hospineil-primary">
            <Store className="h-5 w-5" />
            Vendor status &amp; activity
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={availability} onValueChange={(v) => setAvailability(v as typeof availability)}>
              <SelectTrigger className="w-[160px] bg-white">
                <SelectValue placeholder="Availability" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All vendors</SelectItem>
                <SelectItem value="open">Open only</SelectItem>
                <SelectItem value="closed">Closed only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={vendorFlagFilter} onValueChange={(v) => setVendorFlagFilter(v as typeof vendorFlagFilter)}>
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue placeholder="Activity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All activity</SelectItem>
                <SelectItem value="inactive">No orders 14d+</SelectItem>
                <SelectItem value="suspicious">Suspicious flags</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                placeholder="Search vendor…"
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingVendors ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-hospineil-primary" />
            </div>
          ) : filteredVendors.length === 0 ? (
            <p className="text-gray-500 font-body py-8 text-center">No vendors match your filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-hospineil-primary font-header">
                    <th className="py-2 pr-4">Vendor</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Last order</th>
                    <th className="py-2 pr-4">7d / 14d</th>
                    <th className="py-2 pr-4">Menu Δ 24h</th>
                    <th className="py-2 pr-4">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVendors.map((v) => (
                    <tr key={v.profile_id} className="border-b border-gray-100 hover:bg-gray-50/80">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-gray-900">{v.business_name || v.name || "—"}</div>
                        <div className="text-xs text-gray-500">{v.email}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={v.is_open ? "default" : "secondary"} className={v.is_open ? "bg-green-600" : ""}>
                          {v.is_open ? "Open" : "Closed"}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {v.last_order_at
                          ? new Date(v.last_order_at).toLocaleDateString("en-NG", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs">
                        {v.orders_last_7d} / {v.orders_last_14d}
                      </td>
                      <td className="py-3 pr-4">{v.menu_items_created_24h}</td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {v.flags.length === 0 ? (
                            <span className="text-gray-400 text-xs">—</span>
                          ) : (
                            v.flags.map((f) => (
                              <Badge
                                key={f}
                                variant="outline"
                                className={
                                  f.includes("high_") || f.includes("duplicate")
                                    ? "border-amber-500 text-amber-800 bg-amber-50"
                                    : "text-gray-600"
                                }
                              >
                                {FLAG_LABELS[f] || f}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-4 font-body">
            Suspicious signals are heuristics (menu create rate, cancellation %, duplicate titles), not automatic enforcement.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2 font-header text-hospineil-primary">
            <Bike className="h-5 w-5" />
            Rider activity
          </CardTitle>
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={riderSearch}
              onChange={(e) => setRiderSearch(e.target.value)}
              placeholder="Search rider…"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loadingRiders ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-hospineil-primary" />
            </div>
          ) : filteredRiders.length === 0 ? (
            <p className="text-gray-500 font-body py-8 text-center">No riders found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-hospineil-primary font-header">
                    <th className="py-2 pr-4">Rider</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Assignments today</th>
                    <th className="py-2 pr-4">Current delivery</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRiders.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-gray-900">{r.name || "—"}</div>
                        <div className="text-xs text-gray-500">
                          {[r.phone_number, r.email].filter(Boolean).join(" · ") || r.id.substring(0, 8)}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1">
                          <Badge
                            variant="outline"
                            className={
                              r.operational_status === "busy"
                                ? "border-blue-500 text-blue-800 bg-blue-50"
                                : r.operational_status === "available"
                                  ? "border-green-600 text-green-800 bg-green-50"
                                  : ""
                            }
                          >
                            {r.operational_status === "busy"
                              ? "On delivery"
                              : r.operational_status === "available"
                                ? "Available"
                                : "Inactive"}
                          </Badge>
                          {r.rider_approval_status && (
                            <Badge variant="secondary" className="capitalize">
                              {r.rider_approval_status}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-mono">{r.assignments_today}</td>
                      <td className="py-3 pr-4 text-gray-700">
                        {r.current_delivery ? (
                          <div>
                            <div className="font-medium">{r.current_delivery.label}</div>
                            {r.current_delivery.active_task_count > 1 && (
                              <div className="text-xs text-gray-500">{r.current_delivery.active_task_count} tasks</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-4 text-sm font-body">
        <Link href="/admin/orders" className="text-hospineil-primary hover:underline">
          View all orders →
        </Link>
        <Link href="/admin/vendors" className="text-hospineil-primary hover:underline">
          Vendor approvals →
        </Link>
        <Link href="/admin/riders" className="text-hospineil-primary hover:underline">
          Rider approvals →
        </Link>
      </div>
    </div>
  );
}
