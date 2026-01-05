"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, Users, Store, DollarSign } from "lucide-react";

interface AnalyticsData {
  revenueByMonth: { month: string; revenue: number }[];
  ordersByMonth: { month: string; orders: number }[];
  userGrowth: { month: string; users: number }[];
  subscriptionDistribution: { plan: string; count: number }[];
}

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    revenueByMonth: [],
    ordersByMonth: [],
    userGrowth: [],
    subscriptionDistribution: [],
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Fetch payments for revenue
      const { data: payments } = await supabase
        .from("payments")
        .select("total_amount, created_at")
        .eq("status", "success");

      // Fetch orders
      const { data: orders } = await supabase
        .from("orders")
        .select("created_at");

      // Fetch users
      const { data: users } = await supabase
        .from("profiles")
        .select("created_at, subscription_plan")
        .eq("role", "vendor");

      // Process data by month
      const revenueByMonth = processByMonth(
        payments || [],
        (p) => Number(p.total_amount || 0),
        "revenue"
      );
      const ordersByMonth = processByMonth(orders || [], () => 1, "orders");
      const userGrowth = processByMonth(users || [], () => 1, "users");

      // Subscription distribution
      const subscriptionDistribution = [
        {
          plan: "Free Trial",
          count: (users || []).filter((u) => u.subscription_plan === "free_trial").length,
        },
        {
          plan: "Starter",
          count: (users || []).filter((u) => u.subscription_plan === "starter").length,
        },
        {
          plan: "Professional",
          count: (users || []).filter((u) => u.subscription_plan === "professional").length,
        },
      ];

      setAnalytics({
        revenueByMonth,
        ordersByMonth,
        userGrowth,
        subscriptionDistribution,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const processByMonth = (
    data: any[],
    valueFn: (item: any) => number,
    type: string
  ) => {
    const monthly: Record<string, number> = {};
    data.forEach((item) => {
      const date = new Date(item.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthly[monthKey] = (monthly[monthKey] || 0) + valueFn(item);
    });

    return Object.entries(monthly)
      .map(([month, value]) => ({
        month,
        [type]: value,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6); // Last 6 months
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
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600 mt-2">Platform performance and insights</p>
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





