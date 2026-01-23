"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Truck } from "lucide-react";
import dayjs from "dayjs";

interface OrderRow {
  id: string;
  delivery_charge: number | null;
  status: string;
  created_at: string;
  profiles?: {
    id: string;
    name: string;
    email: string;
  };
  vendor_profiles?: {
    id: string;
    name: string;
    business_name: string;
  };
}

export default function DeliveryCommissionPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [totalDeliveryFees, setTotalDeliveryFees] = useState(0);

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel("admin-delivery-fees-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          setTimeout(() => {
            fetchOrders();
          }, 500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, dateFrom, dateTo]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      if (searchQuery) params.set("search", searchQuery);

      const response = await fetch(`/api/admin/earnings/delivery-fees?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        console.error("Error fetching delivery fees:", await response.text());
        setOrders([]);
        setTotalDeliveryFees(0);
        return;
      }

      const data = await response.json();
      setOrders(data.orders || []);
      setTotalDeliveryFees(data.total_delivery_fees || 0);
    } catch (error) {
      console.error("Error fetching delivery fees:", error);
      setOrders([]);
      setTotalDeliveryFees(0);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    if (!searchQuery) return orders;
    const query = searchQuery.toLowerCase();
    return orders.filter((order) => {
      return (
        order.id.toLowerCase().includes(query) ||
        order.profiles?.name?.toLowerCase().includes(query) ||
        order.profiles?.email?.toLowerCase().includes(query) ||
        order.vendor_profiles?.name?.toLowerCase().includes(query) ||
        order.vendor_profiles?.business_name?.toLowerCase().includes(query) ||
        order.status?.toLowerCase().includes(query)
      );
    });
  }, [orders, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-indigo-600 h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Delivery Commission</h1>
          <p className="text-gray-600 mt-2">Track delivery fees collected by the platform</p>
        </div>
        <Card className="min-w-[240px]">
          <CardContent className="p-4 flex items-center gap-3">
            <Truck className="h-6 w-6 text-hospineil-primary" />
            <div>
              <p className="text-xs text-gray-500">Total Delivery Fees</p>
              <p className="text-lg font-semibold text-gray-900">
                ₦{totalDeliveryFees.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="search"
                placeholder="Order ID, customer, vendor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Accepted">Accepted</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="from">From</Label>
            <Input
              id="from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Delivery Fee</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td className="py-6 px-4 text-center text-gray-500" colSpan={6}>
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">
                        {order.id.slice(0, 8)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-gray-900">{order.profiles?.name || "Unknown"}</div>
                        <div className="text-xs text-gray-500">{order.profiles?.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        {order.vendor_profiles?.business_name || order.vendor_profiles?.name || "Unknown"}
                      </td>
                      <td className="py-3 px-4 text-gray-900">
                        ₦{(Number(order.delivery_charge) || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {dayjs(order.created_at).format("MMM D, YYYY")}
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
