"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Phone } from "lucide-react";

type DispatchRow = {
  order_id: string;
  payment_reference: string | null;
  customer_name: string;
  rider_name: string;
  rider_phone_number: string | null;
};

function formatOrderRef(paymentReference: string | null): string {
  if (!paymentReference) return "—";
  return paymentReference.substring(0, 12);
}

function normalizeTel(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned || null;
}

export default function VendorDispatchPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<DispatchRow[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadDispatch = async () => {
      try {
        setLoading(true);
        setError(null);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user?.id) {
          if (isMounted) {
            setError("You must be logged in to view dispatch.");
            setRows([]);
          }
          return;
        }

        // 1) Fetch only delivery tasks that have an assigned rider.
        const { data: tasks, error: tasksError } = await supabase
          .from("delivery_tasks")
          .select("order_id, rider_id, created_at")
          .eq("vendor_id", user.id)
          .not("rider_id", "is", null)
          .order("created_at", { ascending: false });

        if (tasksError) throw tasksError;

        const tasksRows = (tasks || []) as Array<{
          order_id: string;
          rider_id: string;
        }>;

        if (tasksRows.length === 0) {
          if (!isMounted) return;
          setRows([]);
          return;
        }

        const orderIds = [...new Set(tasksRows.map((t) => t.order_id))];
        const riderIds = [...new Set(tasksRows.map((t) => t.rider_id))];

        // Use maps so we can build a single row per order.
        const riderByOrderId = new Map<string, string>();
        tasksRows.forEach((t) => {
          if (!riderByOrderId.has(t.order_id)) riderByOrderId.set(t.order_id, t.rider_id);
        });

        // 2) Fetch orders + their customer profile ids.
        const { data: ordersData, error: ordersError } = await supabase
          .from("orders")
          .select("id, payment_reference, user_id")
          .eq("vendor_id", user.id)
          .in("id", orderIds);

        if (ordersError) throw ordersError;

        const ordersRows = (ordersData || []) as Array<{
          id: string;
          payment_reference: string | null;
          user_id: string;
        }>;

        if (ordersRows.length === 0) {
          if (!isMounted) return;
          setRows([]);
          return;
        }

        const customerIds = [...new Set(ordersRows.map((o) => o.user_id))];

        // 3) Resolve customer names and rider names/phones from profiles.
        const [{ data: customersData, error: customersError }, { data: ridersData, error: ridersError }] =
          await Promise.all([
            supabase
              .from("profiles")
              .select("id, name")
              .in("id", customerIds),
            supabase
              .from("profiles")
              .select("id, name, phone_number")
              .in("id", riderIds),
          ]);

        if (customersError) throw customersError;
        if (ridersError) throw ridersError;

        const customersRows = (customersData || []) as Array<{
          id: string;
          name: string;
        }>;
        const ridersRows = (ridersData || []) as Array<{
          id: string;
          name: string;
          phone_number: string | null;
        }>;

        const customersMap = new Map(
          customersRows.map((c) => [String(c.id), String(c.name)] as const)
        );

        const ridersMap = new Map(
          ridersRows.map((r) => [
            String(r.id),
            { name: String(r.name), phone: r.phone_number || null },
          ] as const)
        );

        const dispatchRows: DispatchRow[] = ordersRows
          .map((o) => {
            const riderId = riderByOrderId.get(o.id);
            if (!riderId) return null;

            const customerName = customersMap.get(o.user_id);
            const rider = ridersMap.get(riderId);
            if (!customerName || !rider) return null;

            return {
              order_id: o.id,
              payment_reference: o.payment_reference,
              customer_name: customerName,
              rider_name: rider.name,
              rider_phone_number: rider.phone,
            };
          })
          .filter(Boolean) as DispatchRow[];

        if (!isMounted) return;
        setRows(dispatchRows);
      } catch (e) {
        console.error("Dispatch load error:", e);
        if (isMounted) {
          setError(e instanceof Error ? e.message : "Failed to load dispatch data");
          setRows([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadDispatch();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200">
      <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="font-header text-2xl text-hospineil-primary">Dispatch</CardTitle>
          <p className="text-gray-600 font-body text-sm">
            Orders with assigned riders
          </p>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="animate-spin text-hospineil-primary h-6 w-6" />
            <p className="text-sm text-gray-600 font-body">Loading dispatch…</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-red-700 font-body text-sm">{error}</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-hospineil-base-bg/80 px-6 py-12 text-center">
            <p className="text-gray-700 font-body font-medium">No rider assignments yet</p>
            <p className="text-sm text-gray-500 font-body mt-2">When a rider is assigned to an order, it will appear here.</p>
          </div>
        ) : (
          <>
            {/* Desktop/table view */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-600 border-b border-gray-200">
                    <th className="py-3 px-4 font-body font-semibold">Order</th>
                    <th className="py-3 px-4 font-body font-semibold">Customer</th>
                    <th className="py-3 px-4 font-body font-semibold">Assigned Rider</th>
                    <th className="py-3 px-4 font-body font-semibold">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const tel = normalizeTel(r.rider_phone_number);
                    return (
                      <tr key={r.order_id} className="border-b border-gray-100">
                        <td className="py-4 px-4">
                          <div className="font-body font-semibold text-gray-900">
                            {r.order_id}
                          </div>
                          <div className="text-xs text-gray-500 font-body mt-1">
                            Ref: {formatOrderRef(r.payment_reference)}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-body text-gray-800">{r.customer_name}</div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-body text-gray-800">{r.rider_name}</div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="text-gray-800 font-body text-sm">
                              {r.rider_phone_number || "—"}
                            </div>
                            {tel && (
                              <a
                                href={`tel:${tel}`}
                                aria-label={`Call ${r.rider_name}`}
                                className="inline-flex"
                              >
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="rounded-full border-hospineil-primary/30 text-hospineil-primary hover:bg-hospineil-primary/10"
                                >
                                  <Phone className="h-4 w-4" />
                                </Button>
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile/cards */}
            <div className="md:hidden space-y-3">
              {rows.map((r) => {
                const tel = normalizeTel(r.rider_phone_number);
                return (
                  <Card
                    key={r.order_id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-header font-semibold text-gray-900 truncate">
                            Order: {r.order_id}
                          </p>
                          <p className="text-xs text-gray-500 font-body mt-1">
                            Ref: {formatOrderRef(r.payment_reference)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        <div className="text-sm">
                          <span className="text-gray-500 font-body">Customer: </span>
                          <span className="text-gray-900 font-body">{r.customer_name}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-500 font-body">Rider: </span>
                          <span className="text-gray-900 font-body">{r.rider_name}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm">
                            <span className="text-gray-500 font-body">Phone: </span>
                            <span className="text-gray-900 font-body">{r.rider_phone_number || "—"}</span>
                          </div>
                          {tel && (
                            <a href={`tel:${tel}`} aria-label={`Call ${r.rider_name}`} className="inline-flex">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-full border-hospineil-primary/30 text-hospineil-primary hover:bg-hospineil-primary/10"
                              >
                                <Phone className="h-4 w-4" />
                              </Button>
                            </a>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

