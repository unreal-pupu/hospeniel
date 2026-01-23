"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface DeliveryTaskRow {
  rider_id: string;
  delivered_at: string;
}

interface RiderPayoutRow {
  id: string;
  rider_id: string;
  week_start: string;
  week_end: string;
  total_deliveries: number;
  amount_per_delivery: number;
  total_amount: number;
  status: "pending" | "paid";
  paid_at: string | null;
}

interface RiderMeta {
  name: string;
  status: "active" | "inactive";
}

interface RiderPaymentDetail {
  rider_id: string;
  account_name: string;
  bank_name: string;
  account_number: string;
}

interface RiderPaymentMeta {
  accountName: string;
  bankName: string;
  accountNumber: string;
}

const AMOUNT_PER_DELIVERY = 500;

function getStartOfWeek(referenceDate: Date) {
  const start = new Date(referenceDate);
  const day = start.getDay();
  const diff = (day + 6) % 7;
  start.setDate(start.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getEndOfWeek(weekStart: Date) {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function formatWeekRange(weekStart: string, weekEnd: string) {
  const start = new Date(weekStart);
  const end = new Date(weekEnd);
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

function normalizeRiderStatus(status: string | null, isAvailable: boolean | null) {
  if (status) {
    const normalized = status.toLowerCase();
    if (normalized === "approved" || normalized === "active") return "active";
    if (normalized === "rejected" || normalized === "inactive") return "inactive";
  }
  if (typeof isAvailable === "boolean") return isAvailable ? "active" : "inactive";
  return "inactive";
}

function formatCurrency(value: number) {
  return `₦${value.toLocaleString()}`;
}

export default function AdminRiderPayoutsPage() {
  const [payouts, setPayouts] = useState<RiderPayoutRow[]>([]);
  const [riderMeta, setRiderMeta] = useState<Map<string, RiderMeta>>(new Map());
  const [paymentMeta, setPaymentMeta] = useState<Map<string, RiderPaymentMeta>>(new Map());
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const payoutsRef = useRef<RiderPayoutRow[]>([]);

  const currentWeekStart = useMemo(() => getStartOfWeek(new Date()), []);
  const currentWeekEnd = useMemo(() => getEndOfWeek(currentWeekStart), [currentWeekStart]);

  const loadPaymentDetails = useCallback(async (riderIds?: string[]) => {
    const targetIds =
      riderIds ||
      Array.from(new Set(payoutsRef.current.map((row) => row.rider_id)));

    if (targetIds.length === 0) {
      setPaymentMeta(new Map());
      return;
    }

    const { data: paymentRows, error: paymentError } = await supabase
      .from("rider_payment_details")
      .select("rider_id, account_name, bank_name, account_number")
      .in("rider_id", targetIds);

    if (paymentError) {
      console.error("Error fetching rider payment details:", paymentError);
    }

    const paymentMap = new Map<string, RiderPaymentMeta>();
    const rows: RiderPaymentDetail[] = paymentRows ?? [];
    rows.forEach((row: RiderPaymentDetail) => {
      const detail = row;
      paymentMap.set(detail.rider_id, {
        accountName: detail.account_name || "N/A",
        bankName: detail.bank_name || "N/A",
        accountNumber: detail.account_number || "N/A",
      });
    });

    setPaymentMeta(paymentMap);
  }, []);

  useEffect(() => {
    payoutsRef.current = payouts;
  }, [payouts]);

  useEffect(() => {
    async function buildPayouts() {
      try {
        const { data: riders, error: ridersError } = await supabase
          .from("profiles")
          .select("id, name, rider_approval_status, is_available")
          .eq("role", "rider");

        if (ridersError) throw ridersError;

        const riderProfiles = (riders || []) as {
          id: string;
          name: string | null;
          rider_approval_status: string | null;
          is_available: boolean | null;
        }[];

        const { data: deliveredTasks, error: deliveriesError } = await supabase
          .from("delivery_tasks")
          .select("rider_id, delivered_at")
          .in("status", ["Delivered", "delivered"])
          .not("rider_id", "is", null)
          .gte("delivered_at", currentWeekStart.toISOString())
          .lte("delivered_at", currentWeekEnd.toISOString());

        if (deliveriesError) throw deliveriesError;

        const counts = new Map<string, number>();
        const tasks: DeliveryTaskRow[] = deliveredTasks ?? [];
        tasks.forEach((task: DeliveryTaskRow) => {
          const row = task;
          counts.set(row.rider_id, (counts.get(row.rider_id) || 0) + 1);
        });

        const riderIds = riderProfiles.map((rider) => rider.id);

        let existingPayouts: RiderPayoutRow[] = [];
        if (riderIds.length > 0) {
          const { data: payoutRows, error: payoutError } = await supabase
            .from("rider_payouts")
            .select("*")
            .eq("week_start", currentWeekStart.toISOString().split("T")[0])
            .in("rider_id", riderIds);

          if (payoutError) throw payoutError;
          existingPayouts = (payoutRows || []) as RiderPayoutRow[];
        }

        const existingMap = new Map<string, RiderPayoutRow>();
        existingPayouts.forEach((row) => existingMap.set(row.rider_id, row));

        const payoutPayload = riderIds
          .map((riderId) => {
            const totalDeliveries = counts.get(riderId) || 0;
            const existing = existingMap.get(riderId);

            return {
              rider_id: riderId,
              week_start: currentWeekStart.toISOString().split("T")[0],
              week_end: currentWeekEnd.toISOString().split("T")[0],
              total_deliveries: totalDeliveries,
              amount_per_delivery: AMOUNT_PER_DELIVERY,
              total_amount: totalDeliveries * AMOUNT_PER_DELIVERY,
              status: existing?.status || "pending",
              paid_at: existing?.paid_at || null,
            };
          })
          .filter(Boolean);

        if (payoutPayload.length > 0) {
          const { error: upsertError } = await supabase
            .from("rider_payouts")
            .upsert(payoutPayload, { onConflict: "rider_id,week_start" });

          if (upsertError) throw upsertError;
        }

        const { data: payoutRows, error: payoutFetchError } = await supabase
          .from("rider_payouts")
          .select("*")
          .eq("week_start", currentWeekStart.toISOString().split("T")[0])
          .order("total_deliveries", { ascending: false });

        if (payoutFetchError) throw payoutFetchError;

        const payoutList = (payoutRows || []) as RiderPayoutRow[];
        setPayouts(payoutList);

        const payoutRiderIds = Array.from(
          new Set(payoutList.map((row) => row.rider_id))
        );

        const metaMap = new Map<string, RiderMeta>();
        riderProfiles.forEach((rider) => {
          metaMap.set(rider.id, {
            name: rider.name || "Unnamed Rider",
            status: normalizeRiderStatus(
              rider.rider_approval_status,
              rider.is_available
            ),
          });
        });

        setRiderMeta(metaMap);

        await loadPaymentDetails(payoutRiderIds);
      } catch (error) {
        console.error("Error building rider payouts:", error);
      } finally {
        setLoading(false);
      }
    }

    buildPayouts();
  }, [currentWeekEnd, currentWeekStart, loadPaymentDetails]);

  useEffect(() => {
    const channel = supabase
      .channel("rider-payment-details-admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rider_payment_details" },
        () => {
          loadPaymentDetails();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadPaymentDetails]);

  const handleMarkPaid = async (payoutId: string) => {
    setUpdatingId(payoutId);
    try {
      const { error } = await supabase
        .from("rider_payouts")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", payoutId);

      if (error) throw error;

      setPayouts((current) =>
        current.map((row) =>
          row.id === payoutId
            ? { ...row, status: "paid", paid_at: new Date().toISOString() }
            : row
        )
      );
    } catch (error) {
      console.error("Error marking payout as paid:", error);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-indigo-600 h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Rider Payouts</h1>
        <p className="text-gray-600 mt-2">
          Review weekly rider deliveries and mark payouts as paid.
        </p>
      </div>

      <Card>
        <CardHeader />
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Rider Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Week Range</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Total Successful Deliveries</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Amount per Delivery</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Total Payout</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Account Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Bank Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Account Number</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Payout Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payouts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-gray-500">
                      No payout data available.
                    </td>
                  </tr>
                ) : (
                  payouts.map((payout) => {
                    const meta = riderMeta.get(payout.rider_id);
                    const riderName = meta?.name || "Unnamed Rider";
                    const riderStatus = meta?.status || "inactive";
                    const paymentDetail = paymentMeta.get(payout.rider_id);

                    return (
                      <tr key={payout.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span>{riderName}</span>
                            <span className="text-xs text-gray-500 capitalize">{riderStatus}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">{formatWeekRange(payout.week_start, payout.week_end)}</td>
                        <td className="py-3 px-4">{payout.total_deliveries}</td>
                        <td className="py-3 px-4">{formatCurrency(payout.amount_per_delivery)}</td>
                        <td className="py-3 px-4">{formatCurrency(payout.total_amount)}</td>
                        <td className="py-3 px-4">{paymentDetail?.accountName || "N/A"}</td>
                        <td className="py-3 px-4">{paymentDetail?.bankName || "N/A"}</td>
                        <td className="py-3 px-4">{paymentDetail?.accountNumber || "N/A"}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              payout.status === "paid"
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {payout.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            size="sm"
                            disabled={payout.status === "paid" || updatingId === payout.id}
                            onClick={() => handleMarkPaid(payout.id)}
                            className="bg-hospineil-primary text-white hover:bg-hospineil-primary/90"
                          >
                            {updatingId === payout.id ? "Updating..." : "Mark as Paid"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
