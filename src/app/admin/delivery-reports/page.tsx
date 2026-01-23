"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface RiderProfile {
  id: string;
  name: string | null;
  location: string | null;
  rider_approval_status: string | null;
  is_available: boolean | null;
}


interface DeliveryTaskSummary {
  rider_id: string;
  delivered_at: string;
}

interface RiderReportRow {
  id: string;
  name: string;
  zone: string;
  deliveriesToday: number;
  deliveriesWeek: number;
  deliveriesMonth: number;
  lastDeliveryDate: string | null;
  status: "active" | "inactive";
}

function getStartOfDay(referenceDate: Date) {
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getStartOfWeek(referenceDate: Date) {
  const start = new Date(referenceDate);
  const day = start.getDay();
  const diff = (day + 6) % 7;
  start.setDate(start.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getStartOfMonth(referenceDate: Date) {
  return new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
}

function formatDate(value: string | null) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}


function normalizeRiderStatus(status: string | null, isAvailable: boolean | null): "active" | "inactive" {
  if (status) {
    const normalized = status.toLowerCase();
    if (normalized === "approved" || normalized === "active") return "active";
    if (normalized === "rejected" || normalized === "inactive") return "inactive";
  }

  if (typeof isAvailable === "boolean") {
    return isAvailable ? "active" : "inactive";
  }

  return "inactive";
}

function buildCountMap(tasks: DeliveryTaskSummary[]) {
  const counts = new Map<string, number>();
  tasks.forEach((task) => {
    counts.set(task.rider_id, (counts.get(task.rider_id) || 0) + 1);
  });
  return counts;
}

async function fetchDeliveredCounts(startDate: Date, endDate: Date) {
  const { data, error } = await supabase
    .from("delivery_tasks")
    .select("rider_id, delivered_at")
    .eq("status", "Delivered")
    .not("rider_id", "is", null)
    .gte("delivered_at", startDate.toISOString())
    .lte("delivered_at", endDate.toISOString());

  if (error) {
    console.error("Error fetching delivery counts:", error);
    return new Map<string, number>();
  }

  return buildCountMap((data || []) as DeliveryTaskSummary[]);
}

async function fetchLastDeliveryDates(riderIds: string[]) {
  const lastDates = new Map<string, string>();
  const riderIdSet = new Set(riderIds);
  const pageSize = 1000;
  let from = 0;

  while (lastDates.size < riderIdSet.size) {
    const { data, error } = await supabase
      .from("delivery_tasks")
      .select("rider_id, delivered_at")
      .eq("status", "Delivered")
      .not("rider_id", "is", null)
      .order("delivered_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("Error fetching last delivery dates:", error);
      break;
    }

    if (!data || data.length === 0) break;

    for (const task of data as DeliveryTaskSummary[]) {
      if (!riderIdSet.has(task.rider_id)) continue;
      if (!lastDates.has(task.rider_id)) {
        lastDates.set(task.rider_id, task.delivered_at);
      }
      if (lastDates.size === riderIdSet.size) break;
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return lastDates;
}

export default function AdminDeliveryReportsPage() {
  const [reports, setReports] = useState<RiderReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const { data: riders, error: ridersError } = await supabase
          .from("profiles")
          .select("id, name, location, rider_approval_status, is_available")
          .eq("role", "rider");

        if (ridersError) throw ridersError;

        const riderProfiles = (riders || []) as RiderProfile[];
        const riderIds = riderProfiles.map((rider) => rider.id);

        const now = new Date();
        const startOfDay = getStartOfDay(now);
        const startOfWeek = getStartOfWeek(now);
        const startOfMonth = getStartOfMonth(now);

        const [todayCounts, weekCounts, monthCounts, lastDates] = await Promise.all([
          fetchDeliveredCounts(startOfDay, now),
          fetchDeliveredCounts(startOfWeek, now),
          fetchDeliveredCounts(startOfMonth, now),
          fetchLastDeliveryDates(riderIds),
        ]);

        const reportRows = riderProfiles.map((rider) => ({
          id: rider.id,
          name: rider.name || "Unnamed Rider",
          zone: rider.location || "Unassigned",
          deliveriesToday: todayCounts.get(rider.id) || 0,
          deliveriesWeek: weekCounts.get(rider.id) || 0,
          deliveriesMonth: monthCounts.get(rider.id) || 0,
          lastDeliveryDate: lastDates.get(rider.id) || null,
          status: normalizeRiderStatus(
            rider.rider_approval_status,
            rider.is_available
          ),
        }));

        reportRows.sort((a, b) => b.deliveriesMonth - a.deliveriesMonth);
        setReports(reportRows);
      } catch (error) {
        console.error("Error building delivery reports:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

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
        <h1 className="text-3xl font-bold text-gray-900">Delivery Reports</h1>
        <p className="text-gray-600 mt-2">
          Track rider delivery performance using live delivery data.
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
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Rider Zone</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Total Deliveries (Today)</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Total Deliveries (This Week)</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Total Deliveries (This Month)</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Last Delivery Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Rider Status</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500">
                      No rider delivery data available.
                    </td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr key={report.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{report.name}</td>
                      <td className="py-3 px-4">{report.zone}</td>
                      <td className="py-3 px-4">{report.deliveriesToday}</td>
                      <td className="py-3 px-4">{report.deliveriesWeek}</td>
                      <td className="py-3 px-4">{report.deliveriesMonth}</td>
                      <td className="py-3 px-4">{formatDate(report.lastDeliveryDate)}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            report.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {report.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
