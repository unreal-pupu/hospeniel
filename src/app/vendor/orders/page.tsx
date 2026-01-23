"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { 
  Clock, 
  CheckCircle, 
  CheckCircle2,
  XCircle, 
  Package, 
  Search, 
  Filter,
  User,
  DollarSign,
  Loader2,
  RefreshCw,
  Bike
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

dayjs.extend(relativeTime);

// Commission calculation helper
const COMMISSION_RATE = 0.10; // 10%

const calculateCommission = (amount: number): number => {
  return amount * COMMISSION_RATE;
};

const calculateNetEarnings = (amount: number): number => {
  return amount - calculateCommission(amount);
};

interface Order {
  id: string;
  vendor_id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  total_price: number;
  status: "Pending" | "Accepted" | "Confirmed" | "Rejected" | "Completed" | "Cancelled" | "Paid";
  created_at: string;
  updated_at: string;
  delivery_address_line_1?: string | null;
  delivery_city?: string | null;
  delivery_state?: string | null;
  delivery_postal_code?: string | null;
  delivery_phone_number?: string | null;
  delivery_charge?: number | null;
  payment_reference?: string | null;
  menu_items?: {
    id: string;
    title: string;
    image_url: string;
    price: number;
  };
  profiles?: {
    id: string;
    name: string;
  };
  user_settings?: {
    avatar_url: string;
  };
}

interface OrderWithUser extends Order {
  profiles?: {
    id: string;
    name: string;
  };
  user_settings?: {
    avatar_url: string;
  };
  deliveryTask?: {
    id: string;
    status: string;
    rider_id: string | null;
  };
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderWithUser[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<OrderWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [requestingRiderForOrderId, setRequestingRiderForOrderId] = useState<string | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<string>("free_trial");
  const [vendorCategory, setVendorCategory] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(true);

  const isCookOrChef = vendorCategory === "chef" || vendorCategory === "home_cook";
  const canAccessOrders = !isCookOrChef || subscriptionPlan === "professional";

  // Fetch orders with error handling
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        setError("You must be logged in to view orders.");
        return;
      }

      // Fetch orders with related data
      // Note: user_id references auth.users(id), so we need to join profiles and user_settings
      // Explicitly select columns to avoid schema mismatch errors
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id,
          vendor_id,
          user_id,
          product_id,
          quantity,
          total_price,
          status,
          created_at,
          updated_at,
          delivery_address,
          delivery_address_line_1,
          delivery_city,
          delivery_state,
          delivery_zone,
          delivery_postal_code,
          delivery_phone,
          delivery_phone_number,
          delivery_charge,
          special_instructions,
          payment_reference,
          menu_items (
            id,
            title,
            image_url,
            price
          )
        `)
        .eq("vendor_id", user.id)
        .order("created_at", { ascending: false });

      if (ordersError) {
        console.error("❌ Error fetching orders:", ordersError);
        console.error("❌ Error details:", {
          message: ordersError.message,
          code: ordersError.code,
          details: ordersError.details,
          hint: ordersError.hint
        });
        setError(`Failed to load orders: ${ordersError.message || "Unknown error"}`);
        setOrders([]);
        setLoading(false);
        return;
      }

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        setFilteredOrders([]);
        setLoading(false);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(ordersData.map((order) => order.user_id))];

      // Fetch user profiles and settings
      const [profilesResult, settingsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, name")
          .in("id", userIds),
        supabase
          .from("user_settings")
          .select("user_id, avatar_url")
          .in("user_id", userIds)
      ]);

      // Create maps for quick lookup
      interface Profile {
        id: string;
        name: string;
      }
      interface UserSetting {
        user_id: string;
        avatar_url: string | null;
      }
      const profilesMap = new Map<string, Profile>();
      if (profilesResult.data) {
        profilesResult.data.forEach((profile) => {
          profilesMap.set(profile.id, profile);
        });
      }

      const settingsMap = new Map<string, UserSetting>();
      if (settingsResult.data) {
        settingsResult.data.forEach((setting) => {
          settingsMap.set(setting.user_id, setting);
        });
      }

      // Fetch delivery tasks for these orders
      const orderIds = ordersData.map((o) => o.id);
      const { data: deliveryTasks } = await supabase
        .from("delivery_tasks")
        .select("id, order_id, status, rider_id")
        .in("order_id", orderIds);

      // Create map of order_id -> delivery_task
      const deliveryTaskMap = new Map<string, { id: string; status: string; rider_id: string | null }>();
      if (deliveryTasks) {
        deliveryTasks.forEach((task) => {
          deliveryTaskMap.set(task.order_id, {
            id: task.id,
            status: task.status,
            rider_id: task.rider_id,
          });
        });
      }

      // Combine orders with user data - explicitly map all required Order fields
      const ordersWithUsers: OrderWithUser[] = ordersData.map((order) => {
        const menuItem = Array.isArray(order.menu_items)
          ? order.menu_items[0]
          : order.menu_items;
        const resolvedMenuItem = menuItem
          ? {
              id: String(menuItem.id),
              title: String(menuItem.title),
              image_url: String(menuItem.image_url),
              price: Number(menuItem.price),
            }
          : undefined;

        // Ensure all required Order fields are present
        const baseOrder: Order = {
          id: order.id as string,
          vendor_id: order.vendor_id as string,
          user_id: order.user_id as string,
          product_id: order.product_id as string,
          quantity: order.quantity as number,
          total_price: order.total_price as number,
          status: order.status as Order["status"],
          created_at: order.created_at as string,
          updated_at: order.updated_at as string,
          // Handle both delivery_address and delivery_address_line_1 for backward compatibility
          delivery_address_line_1: (order.delivery_address || order.delivery_address_line_1) as string | null | undefined,
          delivery_city: order.delivery_city as string | null | undefined,
          delivery_state: order.delivery_state as string | null | undefined,
          delivery_postal_code: order.delivery_postal_code as string | null | undefined,
          // Handle both delivery_phone and delivery_phone_number for backward compatibility
          delivery_phone_number: (order.delivery_phone || order.delivery_phone_number) as string | null | undefined,
          delivery_charge: order.delivery_charge as number | null | undefined,
          payment_reference: order.payment_reference as string | null | undefined,
          menu_items: resolvedMenuItem,
        };

        const profile = profilesMap.get(order.user_id);
        const setting = settingsMap.get(order.user_id);

        return {
          ...baseOrder,
          profiles: profile
            ? {
                id: profile.id,
                name: profile.name,
              }
            : undefined,
          user_settings: setting
            ? {
                avatar_url: setting.avatar_url || "",
              }
            : undefined,
          deliveryTask: deliveryTaskMap.get(order.id),
        };
      });

      setOrders(ordersWithUsers);
      setFilteredOrders(ordersWithUsers);
      setError(null);
    } catch (fetchOrdersError) {
      console.error("❌ Exception fetching orders:", fetchOrdersError);
      const errorMessage = fetchOrdersError instanceof Error ? fetchOrdersError.message : "An unexpected error occurred";
      setError(`Failed to load orders: ${errorMessage}`);
      setOrders([]);
      setFilteredOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const filterOrders = useCallback(() => {
    let filtered = [...orders];

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((order) => {
        const productName = order.menu_items?.title?.toLowerCase() || "";
        const userName = order.profiles?.name?.toLowerCase() || "";
        return productName.includes(query) || userName.includes(query);
      });
    }

    setFilteredOrders(filtered);
  }, [orders, statusFilter, searchQuery]);

  useEffect(() => {
    const fetchSubscriptionPlan = async () => {
      try {
        setPlanLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("subscription_plan, category")
          .eq("id", user.id)
          .single();

        if (profile) {
          setSubscriptionPlan(profile.subscription_plan || "free_trial");
          setVendorCategory(profile.category || null);
        } else {
          const { data: vendor } = await supabase
            .from("vendors")
            .select("subscription_plan, category")
            .eq("profile_id", user.id)
            .single();

          if (vendor) {
            setSubscriptionPlan(vendor.subscription_plan || "free_trial");
            setVendorCategory(vendor.category || null);
          }
        }
      } catch (planError) {
        console.error("Error fetching subscription plan:", planError);
      } finally {
        setPlanLoading(false);
      }
    };

    fetchSubscriptionPlan();
  }, []);

  useEffect(() => {
    if (planLoading) return;
    if (!canAccessOrders) {
      setLoading(false);
      return;
    }

    fetchOrders();
    
    // Set up real-time subscription for orders
    // Note: We subscribe to all order changes and filter in fetchOrders
    const channel = supabase
      .channel("orders-changes")
      .on(
        "postgres_changes",
        { 
          event: "*", 
          schema: "public", 
          table: "orders"
        },
        (payload) => {
          console.log("🔄 Vendor Orders: Order change detected:", payload);
          console.log("📦 Event type:", payload.eventType);
          // Small delay to ensure database is ready, then refetch
          setTimeout(() => {
            fetchOrders();
          }, 500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [planLoading, canAccessOrders, fetchOrders]);

  useEffect(() => {
    filterOrders();
  }, [filterOrders]);

  const requestRider = async (orderId: string) => {
    try {
      setRequestingRiderForOrderId(orderId);
      console.log("🚴 Requesting rider for order:", orderId);

      // Get current user (vendor) ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("You must be logged in to request a rider");
        return;
      }

      // Create timeout promise (30 seconds)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Request timeout: Rider request took too long")), 30000);
      });

      // Call API to create delivery task
      const fetchPromise = fetch("/api/vendor/delivery-tasks/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          vendorId: user.id,
        }),
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);
      console.log("✅ API response received:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to request rider`);
      }

      const data = await response.json();
      console.log("✅ Delivery task created:", data);

      if (!data.success) {
        throw new Error(data.error || "Failed to request rider");
      }

      alert("Rider request sent! Riders will be notified and can accept the delivery.");

      // Refetch orders to show delivery task status
      fetchOrders().catch((err) => {
        console.error("Error refetching orders after rider request:", err);
      });
    } catch (requestError) {
      console.error("❌ Error requesting rider:", requestError);
      const errorMessage = requestError instanceof Error ? requestError.message : "An error occurred while requesting rider";
      alert(`Failed to request rider: ${errorMessage}`);
    } finally {
      setRequestingRiderForOrderId(null);
      console.log("✅ Rider request flow completed");
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: "Accepted" | "Rejected" | "Completed" | "Cancelled") => {
    try {
      setUpdatingOrderId(orderId);
      console.log("🔄 Updating order status:", { orderId, newStatus });
      
      // Get current user (vendor) ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("You must be logged in to update orders");
        setUpdatingOrderId(null);
        return;
      }

      // Create a timeout promise (30 seconds)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Request timeout: Order update took too long")), 30000);
      });

      // Call API route to update status and create notifications with timeout
      const fetchPromise = fetch("/api/vendor/orders/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          newStatus,
          vendorId: user.id,
        }),
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);
      console.log("✅ API response received:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to update order status`);
      }

      const data = await response.json();
      console.log("✅ API response data:", data);

      if (!data.success) {
        throw new Error(data.error || "Failed to update order status");
      }

      // Update local state immediately for better UX
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );
      setFilteredOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );

      // Show success message
      const statusMessages: Record<string, string> = {
        Accepted: "Order accepted! The customer has been notified.",
        Rejected: "Order declined. The customer has been notified.",
        Completed: "Order marked as completed!",
        Cancelled: "Order cancelled.",
      };
      
      alert(statusMessages[newStatus] || "Order status updated successfully");

      // Refetch in background (non-blocking) to ensure consistency
      fetchOrders().catch((err) => {
        console.error("Error refetching orders after update:", err);
        // Don't show error to user - local state is already updated
      });
    } catch (updateError) {
      console.error("❌ Error updating order status:", updateError);
      const errorMessage = updateError instanceof Error ? updateError.message : "An error occurred while updating the order";
      alert(`Failed to update order: ${errorMessage}`);
    } finally {
      setUpdatingOrderId(null);
      console.log("✅ Order update flow completed");
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-3 py-1 rounded-full text-xs font-semibold";
    switch (status) {
      case "Pending":
        return `${baseClasses} bg-yellow-100 text-yellow-800 border border-yellow-200`;
      case "Paid":
        return `${baseClasses} bg-green-100 text-green-800 border border-green-200`;
      case "Accepted":
        return `${baseClasses} bg-blue-100 text-blue-800 border border-blue-200`;
      case "Confirmed":
        return `${baseClasses} bg-indigo-100 text-indigo-800 border border-indigo-200`;
      case "Rejected":
        return `${baseClasses} bg-red-100 text-red-800 border border-red-200`;
      case "Completed":
        return `${baseClasses} bg-green-100 text-green-800 border border-green-200`;
      case "Cancelled":
        return `${baseClasses} bg-red-100 text-red-800 border border-red-200`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800 border border-gray-200`;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Pending":
        return <Clock className="h-4 w-4" />;
      case "Paid":
        return <DollarSign className="h-4 w-4" />;
      case "Accepted":
        return <Package className="h-4 w-4" />;
      case "Confirmed":
        return <CheckCircle2 className="h-4 w-4" />;
      case "Rejected":
        return <XCircle className="h-4 w-4" />;
      case "Completed":
        return <CheckCircle className="h-4 w-4" />;
      case "Cancelled":
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (planLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-hospineil-base-bg">
        <Loader2 className="animate-spin text-hospineil-primary h-8 w-8 mb-4" />
        <p className="text-gray-600 font-body">Loading orders...</p>
      </div>
    );
  }

  if (!canAccessOrders) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-hospineil-base-bg px-6 text-center">
        <h2 className="text-2xl font-semibold text-hospineil-primary font-header mb-2">
          Orders Access Requires Professional Plan
        </h2>
        <p className="text-gray-600 font-body mb-6 max-w-lg">
          Home cooks and chefs can manage orders only on the Professional plan.
          Upgrade your subscription to access order management tools.
        </p>
        <Button
          onClick={() => (window.location.href = "/vendor/subscription")}
          className="bg-hospineil-primary text-white rounded-lg hover:bg-hospineil-primary/90 hover:scale-105 transition-all font-button"
        >
          Upgrade Plan
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-hospineil-base-bg">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md text-center">
          <XCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error Loading Orders</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <Button
            onClick={() => {
              setError(null);
              fetchOrders();
            }}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-hospineil-primary mb-2 font-header">Orders Management</h1>
        <p className="text-gray-600 font-body">View and manage orders from your customers</p>
      </div>

      {/* Filters and Search */}
      <div className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              type="text"
              placeholder="Search by product name or customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-hospineil-base-bg border-gray-300 focus:ring-hospineil-primary focus:border-hospineil-primary font-body"
            />
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-64">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-hospineil-base-bg border-gray-300 focus:ring-hospineil-primary focus:border-hospineil-primary font-body">
                <Filter className="h-4 w-4 mr-2 text-hospineil-primary" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="bg-white rounded-lg shadow-lg border border-gray-200">
                <SelectItem value="all" className="font-body hover:bg-gray-100">All Status</SelectItem>
                <SelectItem value="Pending" className="font-body hover:bg-gray-100">Pending</SelectItem>
                <SelectItem value="Paid" className="font-body hover:bg-gray-100">Paid</SelectItem>
                <SelectItem value="Accepted" className="font-body hover:bg-gray-100">Accepted</SelectItem>
                <SelectItem value="Confirmed" className="font-body hover:bg-gray-100">Confirmed</SelectItem>
                <SelectItem value="Completed" className="font-body hover:bg-gray-100">Completed</SelectItem>
                <SelectItem value="Rejected" className="font-body hover:bg-gray-100">Rejected</SelectItem>
                <SelectItem value="Cancelled" className="font-body hover:bg-gray-100">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 pt-6 border-t border-gray-300">
          <div className="text-center bg-hospineil-base-bg rounded-lg p-4 shadow-sm border border-gray-200">
            <p className="text-2xl font-bold text-yellow-600 font-header">
              {orders.filter((o) => o.status === "Pending").length}
            </p>
            <p className="text-xs text-gray-600 font-body">Pending</p>
          </div>
          <div className="text-center bg-hospineil-base-bg rounded-lg p-4 shadow-sm border border-gray-200">
            <p className="text-2xl font-bold text-green-600 font-header">
              {orders.filter((o) => o.status === "Paid").length}
            </p>
            <p className="text-xs text-gray-600 font-body">Paid</p>
          </div>
          <div className="text-center bg-hospineil-base-bg rounded-lg p-4 shadow-sm border border-gray-200">
            <p className="text-2xl font-bold text-hospineil-primary font-header">
              {orders.filter((o) => o.status === "Accepted").length}
            </p>
            <p className="text-xs text-gray-600 font-body">Accepted</p>
          </div>
          <div className="text-center bg-hospineil-base-bg rounded-lg p-4 shadow-sm border border-gray-200">
            <p className="text-2xl font-bold text-green-600 font-header">
              {orders.filter((o) => o.status === "Completed").length}
            </p>
            <p className="text-xs text-gray-600 font-body">Completed</p>
          </div>
          <div className="text-center bg-hospineil-base-bg rounded-lg p-4 shadow-sm border border-gray-200 col-span-2 md:col-span-1">
            <p className="text-2xl font-bold text-hospineil-primary font-header">{orders.length}</p>
            <p className="text-xs text-gray-600 font-body">Total Orders</p>
          </div>
        </div>

        {/* Earnings Summary */}
        {orders.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-300">
            <h3 className="text-lg font-semibold text-hospineil-primary mb-4 font-header">Earnings Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-hospineil-base-bg rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600 font-body mb-1">Total Sales</p>
                <p className="text-xl font-bold text-hospineil-primary font-header">
                  ₦{orders.reduce((sum, o) => sum + (o.total_price || 0), 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-hospineil-base-bg rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600 font-body mb-1">Net Earnings</p>
                <p className="text-xl font-bold text-green-600 font-header">
                  ₦{calculateNetEarnings(orders.reduce((sum, o) => sum + (o.total_price || 0), 0)).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-hospineil-light-bg rounded-2xl shadow-md p-12 text-center">
          <Package className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2 font-header">
            {orders.length === 0 ? "No orders yet" : "No orders match your filters"}
          </h3>
          <p className="text-gray-600 font-body">
            {orders.length === 0
              ? "Orders placed by customers will appear here"
              : "Try adjusting your search or filter criteria"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg hover:scale-105 transition-all"
            >
              {/* Order Header */}
              <div className="bg-hospineil-accent px-6 py-4 border-b border-hospineil-accent/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={getStatusBadge(order.status)}>
                    <span className="flex items-center gap-1">
                      {getStatusIcon(order.status)}
                      {order.status}
                    </span>
                  </span>
                  <span className="text-sm text-white/90 font-body">
                    {dayjs(order.created_at).format("MMM DD, YYYY • hh:mm A")}
                  </span>
                </div>
                <span className="text-xs text-white/80 font-body">
                  {dayjs(order.created_at).fromNow()}
                </span>
              </div>

              {/* Order Content */}
              <div className="p-6">
                {/* Customer Info */}
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
                  <div className="relative w-10 h-10 flex-shrink-0">
                    {order.user_settings?.avatar_url ? (
                      <>
                        <Image
                          src={order.user_settings.avatar_url}
                          alt={order.profiles?.name || "Customer"}
                          width={40}
                          height={40}
                          className="rounded-full border-2 border-hospineil-primary/30 object-cover relative z-10"
                          onError={(e) => {
                            // Hide image on error, fallback will show
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                          }}
                        />
                        {/* Fallback avatar (shown if image fails to load) */}
                        <div className="absolute inset-0 w-10 h-10 rounded-full bg-hospineil-primary/20 flex items-center justify-center">
                          <User className="h-5 w-5 text-hospineil-primary" />
                        </div>
                      </>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-hospineil-primary/20 flex items-center justify-center">
                        <User className="h-5 w-5 text-hospineil-primary" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 font-header">
                      {order.profiles?.name || "Unknown Customer"}
                    </p>
                    <p className="text-xs text-gray-600 font-body">Customer</p>
                  </div>
                </div>

                {/* Product Info */}
                <div className="flex gap-4 mb-4">
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 bg-gray-100">
                    {order.menu_items?.image_url ? (
                      <>
                        <Image
                          src={order.menu_items.image_url}
                          alt={order.menu_items.title || "Product"}
                          fill
                          className="object-cover relative z-10"
                          sizes="80px"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                          }}
                          unoptimized
                        />
                        {/* Fallback product image (shown if image fails to load) */}
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                          <Package className="h-8 w-8 text-gray-400" />
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        <Package className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 mb-1 line-clamp-2 font-header">
                      {order.menu_items?.title || "Product Unavailable"}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600 font-body mb-3">
                      <span className="flex items-center gap-1">
                        <Package className="h-4 w-4" />
                        Qty: {order.quantity}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        ₦{order.total_price.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {order.delivery_charge && order.delivery_charge > 0 && (
                      <div className="mb-2 text-xs text-blue-600 flex items-center gap-1 font-body">
                        <Package className="h-3 w-3" />
                        Delivery: ₦{order.delivery_charge.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                      </div>
                    )}
                    {order.payment_reference && (
                      <div className="mb-3 text-xs text-green-600 font-semibold flex items-center gap-1 font-body">
                        <CheckCircle className="h-3 w-3" />
                        Paid - Ref: {order.payment_reference.substring(0, 12)}...
                      </div>
                    )}

                    {/* Commission Breakdown */}
                    {order.total_price > 0 && (
                      <div className="bg-hospineil-base-bg rounded-lg p-3 border border-gray-200 mt-3">
                        <p className="text-xs text-gray-600 font-body leading-relaxed">
                          <span className="font-semibold">₦{order.total_price.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</span> total —{" "}
                          <span className="font-semibold text-hospineil-accent">₦{calculateCommission(order.total_price).toLocaleString("en-NG", { minimumFractionDigits: 2 })} (10% Hospineil fee)</span> deducted.{" "}
                          <span className="font-semibold text-green-600">₦{calculateNetEarnings(order.total_price).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</span> credited to your wallet.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Delivery Information */}
                {(order.delivery_address_line_1 || order.delivery_city || order.delivery_state) && (
                  <div className="pt-4 border-t border-gray-200 mb-4">
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <Package className="h-4 w-4 mt-0.5 flex-shrink-0 text-hospineil-primary" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 mb-1 font-header">Delivery Address:</p>
                        <p className="text-gray-600 font-body">
                          {order.delivery_address_line_1}
                          {order.delivery_city && order.delivery_state && (
                            <span>, {order.delivery_city}, {order.delivery_state}</span>
                          )}
                          {order.delivery_postal_code && (
                            <span> {order.delivery_postal_code}</span>
                          )}
                        </p>
                        {order.delivery_phone_number && (
                          <p className="text-gray-600 mt-1 font-body">
                            Phone: {order.delivery_phone_number}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
                  {(order.status === "Pending" || order.status === "Paid") && (
                    <>
                      <Button
                        onClick={() => updateOrderStatus(order.id, "Accepted")}
                        disabled={updatingOrderId === order.id}
                        className="flex-1 bg-green-600 text-white hover:bg-green-700 hover:scale-105 transition-all font-button"
                        size="sm"
                      >
                        {updatingOrderId === order.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        )}
                        Accept Order
                      </Button>
                      <Button
                        onClick={() => updateOrderStatus(order.id, "Rejected")}
                        disabled={updatingOrderId === order.id}
                        className="flex-1 bg-red-600 text-white hover:bg-red-700 hover:scale-105 transition-all font-button"
                        size="sm"
                      >
                        {updatingOrderId === order.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <XCircle className="h-4 w-4 mr-2" />
                        )}
                        Decline Order
                      </Button>
                    </>
                  )}
                  {order.status === "Accepted" && (
                    <>
                      {!order.deliveryTask && (
                        <Button
                          onClick={() => requestRider(order.id)}
                          disabled={requestingRiderForOrderId === order.id}
                          className="w-full bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 transition-all font-button mb-2"
                          size="sm"
                        >
                          {requestingRiderForOrderId === order.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Bike className="h-4 w-4 mr-2" />
                          )}
                          Request Rider
                        </Button>
                      )}
                      {order.deliveryTask && (
                        <div className="w-full mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm font-semibold text-blue-800 font-body">
                            Delivery Status: {order.deliveryTask.status}
                          </p>
                          {order.deliveryTask.rider_id && (
                            <p className="text-xs text-blue-600 font-body mt-1">
                              Rider assigned
                            </p>
                          )}
                        </div>
                      )}
                      <Button
                        onClick={() => updateOrderStatus(order.id, "Completed")}
                        disabled={updatingOrderId === order.id}
                        className="w-full bg-hospineil-primary text-white hover:bg-hospineil-primary/90 hover:scale-105 transition-all font-button"
                        size="sm"
                      >
                        {updatingOrderId === order.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Package className="h-4 w-4 mr-2" />
                        )}
                        Mark as Completed
                      </Button>
                    </>
                  )}
                  {(order.status === "Completed" || order.status === "Cancelled" || order.status === "Rejected") && (
                    <div className="w-full text-center py-2">
                      <p className="text-sm font-semibold text-gray-700 font-body">
                        Order {order.status.toLowerCase()}
                      </p>
                      {order.status === "Rejected" && (
                        <p className="text-xs text-gray-500 mt-1 font-body">
                          The customer has been notified
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
