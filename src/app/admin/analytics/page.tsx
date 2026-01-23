"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, Users, Store, ShoppingBag, CreditCard } from "lucide-react";

interface AnalyticsData {
  metrics: {
    totalOrders: number;
    totalPayments: number;
    totalServiceRequests: number;
    totalUsers: number;
    totalVendors: number;
  };
  revenueByMonth: { month: string; revenue: number }[];
  ordersByMonth: { month: string; orders: number }[];
  serviceRequestsByMonth: { month: string; serviceRequests: number }[];
  userGrowth: { month: string; users: number }[];
  subscriptionDistribution: { plan: string; count: number }[];
}

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    metrics: {
      totalOrders: 0,
      totalPayments: 0,
      totalServiceRequests: 0,
      totalUsers: 0,
      totalVendors: 0,
    },
    revenueByMonth: [],
    ordersByMonth: [],
    serviceRequestsByMonth: [],
    userGrowth: [],
    subscriptionDistribution: [],
  });

  const fetchAnalytics = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAnalytics((prev) => ({ ...prev }));
        return;
      }

      const response = await fetch("/api/admin/analytics", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        console.error("Error fetching analytics:", await response.text());
        return;
      }

      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    const channel = supabase
      .channel("admin-analytics-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, fetchAnalytics)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, fetchAnalytics)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_requests" }, fetchAnalytics)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, fetchAnalytics)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAnalytics]);

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
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-2">Platform performance and insights</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-gray-600">
              <ShoppingBag className="h-4 w-4" />
              Total Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-hospineil-primary">
              {analytics.metrics.totalOrders}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-gray-600">
              <CreditCard className="h-4 w-4" />
              Total Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-hospineil-primary">
              {analytics.metrics.totalPayments}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-gray-600">
              <TrendingUp className="h-4 w-4" />
              Service Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-hospineil-primary">
              {analytics.metrics.totalServiceRequests}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-gray-600">
              <Users className="h-4 w-4" />
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-hospineil-primary">
              {analytics.metrics.totalUsers}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-gray-600">
              <Store className="h-4 w-4" />
              Total Vendors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-hospineil-primary">
              {analytics.metrics.totalVendors}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Revenue Trend (Last 6 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {analytics.revenueByMonth.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No revenue data available</p>
            ) : (
              analytics.revenueByMonth.map((item) => (
                <div key={item.month} className="flex items-center gap-4">
                  <div className="w-24 text-sm text-gray-600">{item.month}</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                    <div
                      className="bg-indigo-600 h-6 rounded-full flex items-center justify-end pr-2"
                      style={{
                        width: `${
                          (item.revenue /
                            Math.max(
                              ...analytics.revenueByMonth.map((i) => i.revenue)
                            )) *
                          100
                        }%`,
                      }}
                    >
                      <span className="text-xs text-white font-semibold">
                        ₦{(item.revenue / 1000).toFixed(0)}k
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Orders Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Orders Trend (Last 6 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {analytics.ordersByMonth.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No orders data available</p>
            ) : (
              analytics.ordersByMonth.map((item) => (
                <div key={item.month} className="flex items-center gap-4">
                  <div className="w-24 text-sm text-gray-600">{item.month}</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                    <div
                      className="bg-green-600 h-6 rounded-full flex items-center justify-end pr-2"
                      style={{
                        width: `${
                          (item.orders /
                            Math.max(...analytics.ordersByMonth.map((i) => i.orders))) *
                          100
                        }%`,
                      }}
                    >
                      <span className="text-xs text-white font-semibold">
                        {item.orders}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Service Requests Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Service Requests Trend (Last 6 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {analytics.serviceRequestsByMonth.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No service request data available</p>
            ) : (
              analytics.serviceRequestsByMonth.map((item) => (
                <div key={item.month} className="flex items-center gap-4">
                  <div className="w-24 text-sm text-gray-600">{item.month}</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                    <div
                      className="bg-emerald-600 h-6 rounded-full flex items-center justify-end pr-2"
                      style={{
                        width: `${
                          (item.serviceRequests /
                            Math.max(...analytics.serviceRequestsByMonth.map((i) => i.serviceRequests))) *
                          100
                        }%`,
                      }}
                    >
                      <span className="text-xs text-white font-semibold">{item.serviceRequests}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Subscription Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Subscription Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.subscriptionDistribution.map((item) => (
              <div key={item.plan} className="flex items-center gap-4">
                <div className="w-32 text-sm font-medium text-gray-700">
                  {item.plan}
                </div>
                <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                  <div
                    className="bg-purple-600 h-6 rounded-full flex items-center justify-end pr-2"
                    style={{
                      width: `${
                        (item.count /
                          analytics.subscriptionDistribution.reduce(
                            (sum, i) => sum + i.count,
                            0
                          )) *
                        100
                      }%`,
                    }}
                  >
                    <span className="text-xs text-white font-semibold">
                      {item.count}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}





