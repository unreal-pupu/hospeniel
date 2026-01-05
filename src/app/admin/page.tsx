"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Store,
  ShoppingBag,
  CreditCard,
  TrendingUp,
  DollarSign,
  Package,
  UserCheck,
  Loader2,
} from "lucide-react";

interface DashboardStats {
  totalUsers: number;
  totalVendors: number;
  activeOrders: number;
  totalRevenue: number;
  totalCommission: number;
  pendingPayouts: number;
  freeTrialVendors: number;
  professionalVendors: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalVendors: 0,
    activeOrders: 0,
    totalRevenue: 0,
    totalCommission: 0,
    pendingPayouts: 0,
    freeTrialVendors: 0,
    professionalVendors: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch all stats in parallel
        const [
          usersResult,
          vendorsResult,
          ordersResult,
          paymentsResult,
          payoutsResult,
          subscriptionResult,
        ] = await Promise.all([
          // Total users (non-vendor)
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .neq("role", "vendor"),
          
          // Total vendors
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("role", "vendor"),
          
          // Active orders (Pending, Paid, Confirmed, Accepted)
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .in("status", ["Pending", "Paid", "Confirmed", "Accepted"]),
          
          // Total revenue and commission
          supabase
            .from("payments")
            .select("total_amount, commission_amount")
            .eq("status", "success"),
          
          // Pending payouts
          supabase
            .from("vendor_payouts")
            .select("payout_amount")
            .eq("status", "pending"),
          
          // Subscription stats
          supabase
            .from("profiles")
            .select("subscription_plan")
            .eq("role", "vendor"),
        ]);

        const totalRevenue = (paymentsResult.data || []).reduce(
          (sum, p) => sum + (Number(p.total_amount) || 0),
          0
        );

        const totalCommission = (paymentsResult.data || []).reduce(
          (sum, p) => sum + (Number(p.commission_amount) || 0),
          0
        );

        const pendingPayouts = (payoutsResult.data || []).reduce(
          (sum, p) => sum + (Number(p.payout_amount) || 0),
          0
        );

        const freeTrialVendors = (subscriptionResult.data || []).filter(
          (p) => p.subscription_plan === "free_trial"
        ).length;

        const professionalVendors = (subscriptionResult.data || []).filter(
          (p) => p.subscription_plan === "professional"
        ).length;

        setStats({
          totalUsers: usersResult.count || 0,
          totalVendors: vendorsResult.count || 0,
          activeOrders: ordersResult.count || 0,
          totalRevenue,
          totalCommission,
          pendingPayouts,
          freeTrialVendors,
          professionalVendors,
        });
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Set up real-time subscriptions for dashboard updates
    const ordersChannel = supabase
      .channel("admin-dashboard-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          console.log("🔄 Admin Dashboard: Order change detected, refreshing stats...");
          setTimeout(() => {
            fetchStats();
          }, 500);
        }
      )
      .subscribe();

    const paymentsChannel = supabase
      .channel("admin-dashboard-payments")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
        },
        () => {
          console.log("🔄 Admin Dashboard: Payment change detected, refreshing stats...");
          setTimeout(() => {
            fetchStats();
          }, 500);
        }
      )
      .subscribe();

    const profilesChannel = supabase
      .channel("admin-dashboard-profiles")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
        },
        () => {
          console.log("🔄 Admin Dashboard: Profile change detected, refreshing stats...");
          setTimeout(() => {
            fetchStats();
          }, 500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(paymentsChannel);
      supabase.removeChannel(profilesChannel);
    };
  }, []);

  const statCards = [
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Total Vendors",
      value: stats.totalVendors,
      icon: Store,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Active Orders",
      value: stats.activeOrders,
      icon: ShoppingBag,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Total Revenue",
      value: `₦${stats.totalRevenue.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      title: "Platform Commission",
      value: `₦${stats.totalCommission.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      title: "Pending Payouts",
      value: `₦${stats.pendingPayouts.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
      icon: CreditCard,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "Free Trial Vendors",
      value: stats.freeTrialVendors,
      icon: Package,
      color: "text-gray-600",
      bgColor: "bg-gray-50",
    },
    {
      title: "Professional Vendors",
      value: stats.professionalVendors,
      icon: UserCheck,
      color: "text-pink-600",
      bgColor: "bg-pink-50",
    },
  ];

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
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-gray-600 mt-2">Welcome to the Admin Dashboard</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {card.title}
                </CardTitle>
                <div className={`${card.bgColor} p-2 rounded-lg`}>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  {card.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Commission and Orders Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Completed Orders with Commission */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Completed Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <CompletedOrdersList />
          </CardContent>
        </Card>

        {/* Commission Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Commission Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <CommissionSummary />
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/admin/users"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <h3 className="font-semibold text-gray-900">Manage Users</h3>
              <p className="text-sm text-gray-600 mt-1">View and manage user accounts</p>
            </a>
            <a
              href="/admin/vendors"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <h3 className="font-semibold text-gray-900">Manage Vendors</h3>
              <p className="text-sm text-gray-600 mt-1">Approve vendors and manage subscriptions</p>
            </a>
            <a
              href="/admin/payments"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <h3 className="font-semibold text-gray-900">View Payments</h3>
              <p className="text-sm text-gray-600 mt-1">Monitor transactions and revenue</p>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Commission calculation constant
const COMMISSION_RATE = 0.10; // 10%

interface CompletedOrder {
  id: string;
  user_id: string;
  vendor_id: string;
  total_price: number;
  status: string;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    name: string;
    email: string;
  };
  vendor_profiles?: {
    name: string;
    business_name: string;
  };
  menu_items?: {
    title: string;
  };
}

function CompletedOrdersList() {
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const fetchCompletedOrders = async () => {
      try {
        // Fetch completed and paid orders
        const { data, error } = await supabase
          .from("orders")
          .select(`
            id,
            user_id,
            vendor_id,
            total_price,
            status,
            payment_reference,
            created_at,
            updated_at,
            menu_items (
              title
            )
          `)
          .in("status", ["Completed", "Paid"])
          .order("created_at", { ascending: false })
          .limit(10);

        if (error) {
          console.error("Error fetching completed orders:", error);
          if (isMounted) setLoading(false);
          return;
        }

        if (!data || data.length === 0) {
          if (isMounted) {
            setOrders([]);
            setLoading(false);
          }
          return;
        }

        // Fetch user and vendor profiles
        const userIds = [...new Set(data.map((o) => o.user_id).filter(Boolean))];
        const vendorIds = [...new Set(data.map((o) => o.vendor_id).filter(Boolean))];

        const [userProfiles, vendorProfiles] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, name, email")
            .in("id", userIds),
          supabase
            .from("profiles")
            .select("id, name")
            .in("id", vendorIds)
            .eq("role", "vendor"),
        ]);

        const [vendors] = await supabase
          .from("vendors")
          .select("profile_id, business_name")
          .in("profile_id", vendorIds);

        const userMap = new Map();
        userProfiles.data?.forEach((p) => userMap.set(p.id, p));

        const vendorMap = new Map();
        vendorProfiles.data?.forEach((p) => vendorMap.set(p.id, p));
        vendors?.data?.forEach((v) => {
          if (v.profile_id) {
            const profile = vendorMap.get(v.profile_id);
            if (profile) {
              vendorMap.set(v.profile_id, {
                ...profile,
                business_name: v.business_name || profile.name,
              });
            }
          }
        });

        const ordersWithDetails = data.map((order) => ({
          ...order,
          profiles: userMap.get(order.user_id) || { name: "Unknown User", email: "N/A" },
          vendor_profiles: vendorMap.get(order.vendor_id) || { name: "Unknown Vendor", business_name: "N/A" },
        }));

        if (isMounted) {
          setOrders(ordersWithDetails);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error in fetchCompletedOrders:", error);
        if (isMounted) setLoading(false);
      }
    };

    fetchCompletedOrders();

    // Set up real-time subscription for completed orders
    const channel = supabase
      .channel("admin-completed-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          console.log("🔄 Completed Orders: Change detected:", payload);
          // Only refetch if status changed to/from Completed or Paid
          if (
            payload.eventType === "UPDATE" &&
            (payload.new.status === "Completed" ||
              payload.new.status === "Paid" ||
              payload.old?.status === "Completed" ||
              payload.old?.status === "Paid")
          ) {
            setTimeout(() => {
              fetchCompletedOrders();
            }, 500);
          } else if (payload.eventType === "INSERT") {
            setTimeout(() => {
              fetchCompletedOrders();
            }, 500);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return <div className="text-center py-4">Loading orders...</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Package className="mx-auto h-12 w-12 text-gray-400 mb-2" />
        <p>No completed orders yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const commission = order.total_price * COMMISSION_RATE;
        return (
          <div
            key={order.id}
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-semibold text-sm">
                  {order.menu_items?.title || "Order"}
                </p>
                <p className="text-xs text-gray-600">
                  User: {order.profiles?.name || "N/A"} | Vendor: {order.vendor_profiles?.business_name || order.vendor_profiles?.name || "N/A"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm">₦{order.total_price.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-green-600">Commission: ₦{commission.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            <div className="flex justify-between items-center text-xs text-gray-500">
              <span>{new Date(order.created_at).toLocaleDateString()}</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                {order.status}
              </span>
            </div>
          </div>
        );
      })}
      <a
        href="/admin/orders"
        className="block text-center text-sm text-indigo-600 hover:text-indigo-800 mt-4"
      >
        View all orders →
      </a>
    </div>
  );
}

function CommissionSummary() {
  const [summary, setSummary] = useState({
    totalCommission: 0,
    totalOrders: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCommissionSummary = async () => {
      try {
        // Fetch all completed and paid orders
        const { data, error } = await supabase
          .from("orders")
          .select("total_price, status")
          .in("status", ["Completed", "Paid"]);

        if (error) {
          console.error("Error fetching commission summary:", error);
          setLoading(false);
          return;
        }

        if (!data || data.length === 0) {
          setSummary({ totalCommission: 0, totalOrders: 0, totalRevenue: 0 });
          setLoading(false);
          return;
        }

        const totalRevenue = data.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0);
        const totalCommission = totalRevenue * COMMISSION_RATE;

        setSummary({
          totalCommission,
          totalOrders: data.length,
          totalRevenue,
        });
      } catch (error) {
        console.error("Error in fetchCommissionSummary:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCommissionSummary();

    // Set up real-time subscription for commission summary
    const channel = supabase
      .channel("admin-commission-summary")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          console.log("🔄 Commission Summary: Order change detected:", payload);
          // Refetch when order status changes to/from Completed or Paid
          if (
            payload.eventType === "UPDATE" &&
            (payload.new.status === "Completed" ||
              payload.new.status === "Paid" ||
              payload.old?.status === "Completed" ||
              payload.old?.status === "Paid")
          ) {
            setTimeout(() => {
              fetchCommissionSummary();
            }, 500);
          } else if (payload.eventType === "INSERT") {
            setTimeout(() => {
              fetchCommissionSummary();
            }, 500);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return <div className="text-center py-4">Loading summary...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Total Commission Earned</span>
          <span className="text-2xl font-bold text-yellow-600">
            ₦{summary.totalCommission.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="text-xs text-gray-600">
          From {summary.totalOrders} completed order{summary.totalOrders !== 1 ? "s" : ""}
        </div>
      </div>
      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Total Revenue</span>
          <span className="text-xl font-semibold text-green-600">
            ₦{summary.totalRevenue.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="text-xs text-gray-600">
          Commission rate: {(COMMISSION_RATE * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  );
}




