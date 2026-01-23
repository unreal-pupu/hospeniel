"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import type { RealtimeChannel, RealtimePostgresChangesPayload, REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  CheckCircle,
  XCircle,
  Package,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShoppingBag,
  Calendar,
  DollarSign,
  User,
  Filter,
  MessageSquare,
  ChefHat,
  Store,
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

dayjs.extend(relativeTime);

interface Order {
  id: string;
  user_id: string;
  vendor_id: string;
  product_id: string;
  quantity: number;
  total_price: number;
  status: "Pending" | "Accepted" | "Confirmed" | "Rejected" | "Completed" | "Cancelled" | "Paid";
  payment_reference?: string;
  created_at: string;
  updated_at: string;
  delivery_address_line_1?: string | null;
  delivery_city?: string | null;
  delivery_state?: string | null;
  delivery_postal_code?: string | null;
  delivery_phone_number?: string | null;
  delivery_charge?: number | null;
  menu_items?: {
    id: string;
    title: string;
    image_url: string;
    price: number;
  };
  vendors?: {
    id: string;
    name: string;
    image_url: string;
    location?: string;
  };
}

interface ServiceRequest {
  id: string;
  user_id: string;
  vendor_id: string;
  message: string;
  contact_info: string | null;
  status: "New" | "Viewed" | "Responded" | "Price_Confirmed" | "Paid" | "Completed" | "Cancelled";
  final_price: number | null;
  price_confirmed: boolean;
  payment_reference: string | null;
  payment_method: string | null;
  payment_status: "pending" | "paid" | "failed" | "refunded" | null;
  amount_paid: number | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  vendor?: {
    id: string;
    name: string | null;
    category: string | null;
  } | null;
}

interface VendorProfileRow {
  id: string;
  name: string | null;
  category: string | null;
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [notification, setNotification] = useState<{
    message: string;
    type: "success" | "info" | "warning";
  } | null>(null);
  const previousStatuses = useRef<Map<string, string>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Declare showNotification first (no dependencies)
  const showNotification = useCallback((
    message: string,
    type: "success" | "info" | "warning" = "info"
  ) => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  }, []);

  // Declare fetchOrders (depends on router)
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);

      // Get authenticated user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        alert("Please log in to view your orders.");
        router.push("/loginpage");
        return;
      }

      // Fetch orders for the current user
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          *,
          menu_items (
            id,
            title,
            image_url,
            price
          )
        `)
        .eq("user_id", user.id)
        .or("order_type.is.null,order_type.eq.menu")
        .order("created_at", { ascending: false });

      if (ordersError) {
        console.error("Error fetching orders:", ordersError);
        setOrders([]);
      }

      // Fetch paid service requests for the current user
      // Show all service requests that have been paid (status = 'Paid' or 'Completed')
      // Also include requests with payment_reference set (even if status hasn't updated yet)
      const { data: serviceRequestsData, error: serviceRequestsError } = await supabase
        .from("service_requests")
        .select("id, user_id, vendor_id, message, contact_info, status, final_price, price_confirmed, payment_reference, payment_method, payment_status, amount_paid, paid_at, created_at, updated_at")
        .eq("user_id", user.id)
        .or("payment_status.eq.paid,status.eq.Paid,status.eq.Completed,payment_reference.not.is.null")
        .order("created_at", { ascending: false });

      if (serviceRequestsError) {
        console.error("Error fetching service requests:", serviceRequestsError);
        setServiceRequests([]);
      } else if (serviceRequestsData && serviceRequestsData.length > 0) {
        // Fetch vendor profiles for service requests
        const requestRows: ServiceRequest[] = serviceRequestsData ?? [];
        const vendorIds = [
          ...new Set(requestRows.map((r: ServiceRequest) => r.vendor_id).filter(Boolean)),
        ];
        const { data: vendorProfiles } = await supabase
          .from("profiles")
          .select("id, name, category")
          .in("id", vendorIds);

        const vendorRows: VendorProfileRow[] = vendorProfiles ?? [];
        const vendorMap = new Map(vendorRows.map((p: VendorProfileRow) => [p.id, p]));
        const requestsWithVendors = requestRows.map((req: ServiceRequest) => ({
          ...req,
          vendor: vendorMap.get(req.vendor_id) || null
        }));
        setServiceRequests(requestsWithVendors);
      } else {
        setServiceRequests([]);
      }

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        setFilteredOrders([]);
        setLoading(false);
        return;
      }

      // Get unique vendor IDs
      interface OrderData {
        id: string;
        user_id: string;
        vendor_id: string;
        product_id: string;
        quantity: number;
        total_price: number;
        status: string;
        payment_reference?: string | null;
        created_at: string;
        updated_at: string;
        delivery_address_line_1?: string | null;
        delivery_city?: string | null;
        delivery_state?: string | null;
        delivery_postal_code?: string | null;
        delivery_phone_number?: string | null;
        delivery_charge?: number | null;
        menu_items?: {
          id: string;
          title: string;
          image_url: string;
          price: number;
        };
        [key: string]: unknown;
      }
      interface VendorData {
        id: string;
        name: string;
        image_url: string | null;
        location: string | null;
        profile_id: string;
      }
      
      const vendorIds = [...new Set(ordersData.map((order: OrderData) => order.vendor_id))];

      // Fetch vendor information
      const { data: vendorsData, error: vendorsError } = await supabase
        .from("vendors")
        .select("id, name, image_url, location, profile_id")
        .in("profile_id", vendorIds);

      if (vendorsError) {
        console.error("Error fetching vendors:", vendorsError);
      }

      // Create a map of vendor_id (auth.users id) to vendor data
      const vendorsMap = new Map<string, VendorData>();
      if (vendorsData) {
        vendorsData.forEach((vendor: VendorData) => {
          vendorsMap.set(vendor.profile_id, vendor);
        });
      }

      // Combine orders with vendor information
      const ordersWithVendors: Order[] = ordersData.map((order: OrderData) => {
        const vendor = vendorsMap.get(order.vendor_id);
        // Store previous status for comparison
        previousStatuses.current.set(order.id, order.status);
        return {
          id: order.id,
          user_id: order.user_id,
          vendor_id: order.vendor_id,
          product_id: order.product_id,
          quantity: order.quantity,
          total_price: order.total_price,
          status: order.status as Order["status"],
          payment_reference: order.payment_reference || undefined,
          created_at: order.created_at,
          updated_at: order.updated_at,
          delivery_address_line_1: order.delivery_address_line_1 || undefined,
          delivery_city: order.delivery_city || undefined,
          delivery_state: order.delivery_state || undefined,
          delivery_postal_code: order.delivery_postal_code || undefined,
          delivery_phone_number: order.delivery_phone_number || undefined,
          delivery_charge: order.delivery_charge || undefined,
          menu_items: order.menu_items,
          vendors: vendor
            ? {
                id: vendor.id,
                name: vendor.name,
                image_url: vendor.image_url || "",
                location: vendor.location || undefined,
              }
            : undefined,
        };
      });

      setOrders(ordersWithVendors);
      setFilteredOrders(ordersWithVendors);
    } catch (error) {
      console.error("Error fetching orders:", error);
      setOrders([]);
      setFilteredOrders([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Declare setupRealtimeSubscription (depends on fetchOrders and showNotification)
  const setupRealtimeSubscription = useCallback(async () => {
    // Get authenticated user first
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    // Set up real-time subscription for order status changes
    // TypeScript overload resolution issue - using type assertion to match postgres_changes overload
    const channel = (supabase.channel("user-orders-changes") as {
      on: <T = { eventType: string; new?: Order; old?: Order }>(
        event: "postgres_changes",
        config: {
          event: string;
          schema: string;
          table: string;
          filter?: string;
        },
        callback: (payload: T) => void
      ) => RealtimeChannel;
    }).on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: { eventType: string; new?: Order; old?: Order }) => {
          console.log("Order change detected:", payload);

          if (payload.eventType === "UPDATE") {
            const updatedOrder = payload.new as Order;
            const previousStatus = previousStatuses.current.get(updatedOrder.id);
            const newStatus = updatedOrder.status;

            // Update the order in state
            setOrders((prevOrders) => {
              const updated = prevOrders.map((order) => {
                if (order.id === updatedOrder.id) {
                  // Update existing order
                  const updatedOrderWithRelations = {
                    ...updatedOrder,
                    menu_items: order.menu_items,
                    vendors: order.vendors,
                  };
                  return updatedOrderWithRelations;
                }
                return order;
              });
              return updated;
            });

            // Show notification if status changed
            if (previousStatus && previousStatus !== newStatus) {
              showNotification(
                `Order status updated to ${newStatus}`,
                newStatus === "Rejected" || newStatus === "Cancelled"
                  ? "warning"
                  : newStatus === "Completed"
                  ? "success"
                  : "info"
              );
            }

            // Update previous status
            previousStatuses.current.set(updatedOrder.id, newStatus);
          } else if (payload.eventType === "INSERT") {
            // New order created - refetch to get all related data (menu_items, vendors)
            console.log("✅ New order inserted, refetching orders...");
            console.log("📦 New order data:", payload.new);
            // Small delay to ensure database is ready
            setTimeout(() => {
              void fetchOrders();
            }, 500);
            showNotification("New order placed!", "success");
          }
        }
      )
      .subscribe((status: REALTIME_SUBSCRIBE_STATES) => {
        console.log("Realtime subscription status:", status);
      });

    channelRef.current = channel;

    // Set up real-time subscription for service requests
    const serviceRequestsChannel = supabase
      .channel("user-service-requests-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "service_requests",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          console.log("🔄 Service request change detected:", payload);
          // Refetch service requests when they change
          setTimeout(() => {
            void fetchOrders();
          }, 500);
        }
      )
      .subscribe((status: REALTIME_SUBSCRIBE_STATES) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ Successfully subscribed to service_requests real-time updates");
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ Error subscribing to service_requests real-time updates");
        }
      });

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      supabase.removeChannel(serviceRequestsChannel);
    };
  }, [fetchOrders, showNotification]);

  // Declare filterOrders (depends on orders and statusFilter)
  const filterOrders = useCallback(() => {
    let filtered = [...orders];

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    setFilteredOrders(filtered);
  }, [orders, statusFilter]);

  // useEffect hooks after all function declarations
  useEffect(() => {
    let cleanupRealtime: (() => void) | null = null;
    const initialize = async () => {
      await fetchOrders();
      cleanupRealtime = await setupRealtimeSubscription();
    };

    initialize();

    return () => {
      if (cleanupRealtime) {
        cleanupRealtime();
      } else if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [fetchOrders, setupRealtimeSubscription]);

  useEffect(() => {
    filterOrders();
  }, [statusFilter, orders, filterOrders]);

  const getStatusBadge = (status: string) => {
    const baseClasses =
      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold";
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
        return `${baseClasses} bg-gray-100 text-gray-800 border border-gray-200`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800 border border-gray-200`;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Pending":
        return <Clock className="h-3.5 w-3.5" />;
      case "Paid":
        return <DollarSign className="h-3.5 w-3.5" />;
      case "Accepted":
        return <CheckCircle className="h-3.5 w-3.5" />;
      case "Confirmed":
        return <CheckCircle2 className="h-3.5 w-3.5" />;
      case "Rejected":
        return <XCircle className="h-3.5 w-3.5" />;
      case "Completed":
        return <Package className="h-3.5 w-3.5" />;
      case "Cancelled":
        return <AlertCircle className="h-3.5 w-3.5" />;
      default:
        return <Clock className="h-3.5 w-3.5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-indigo-600 h-8 w-8 mb-4" />
        <p className="text-gray-600">Loading your orders...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50">
      {/* Notification Toast */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
            notification.type === "success"
              ? "bg-green-500 text-white"
              : notification.type === "warning"
              ? "bg-yellow-500 text-white"
              : "bg-blue-500 text-white"
          } animate-in slide-in-from-right`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" && (
              <CheckCircle className="h-5 w-5" />
            )}
            {notification.type === "warning" && (
              <AlertCircle className="h-5 w-5" />
            )}
            {notification.type === "info" && (
              <Clock className="h-5 w-5" />
            )}
            <p className="font-medium">{notification.message}</p>
          </div>
        </div>
      )}

      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                My Orders
              </h1>
              <p className="text-gray-600">
                Track and manage your orders in real-time
              </p>
            </div>
            <Button
              onClick={() => router.push("/explore")}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <ShoppingBag className="h-4 w-4 mr-2" />
              Browse Menu
            </Button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Accepted">Accepted</SelectItem>
                <SelectItem value="Confirmed">Confirmed</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            {/* Stats Summary */}
            <div className="flex gap-4">
              <div className="text-center px-4 py-2 bg-white rounded-lg shadow-sm">
                <p className="text-2xl font-bold text-yellow-600">
                  {orders.filter((o) => o.status === "Pending").length}
                </p>
                <p className="text-xs text-gray-500">Pending</p>
              </div>
              <div className="text-center px-4 py-2 bg-white rounded-lg shadow-sm">
                <p className="text-2xl font-bold text-green-600">
                  {orders.filter((o) => o.status === "Paid").length}
                </p>
                <p className="text-xs text-gray-500">Paid</p>
              </div>
              <div className="text-center px-4 py-2 bg-white rounded-lg shadow-sm">
                <p className="text-2xl font-bold text-blue-600">
                  {orders.filter((o) => o.status === "Accepted").length}
                </p>
                <p className="text-xs text-gray-500">Accepted</p>
              </div>
              <div className="text-center px-4 py-2 bg-white rounded-lg shadow-sm">
                <p className="text-2xl font-bold text-green-600">
                  {orders.filter((o) => o.status === "Completed").length}
                </p>
                <p className="text-xs text-gray-500">Completed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Service Requests Section */}
        {serviceRequests.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Service Requests</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {serviceRequests.map((request) => (
                <Card key={request.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {request.vendor?.category === "chef" || request.vendor?.category === "home_cook" ? (
                            <ChefHat className="h-5 w-5 text-indigo-600" />
                          ) : (
                            <Store className="h-5 w-5 text-indigo-600" />
                          )}
                          <h3 className="text-lg font-semibold text-gray-900">
                            {request.vendor?.name || "Unknown Vendor"}
                          </h3>
                          <Badge
                            variant="outline"
                            className={request.payment_status === "paid" || request.status === "Paid" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}
                          >
                            {request.payment_status === "paid" ? "Paid" : request.status}
                          </Badge>
                          {request.vendor?.category && (
                            <Badge variant="outline" className="bg-indigo-100 text-indigo-800">
                              {request.vendor.category === "chef" ? "Chef" : request.vendor.category === "home_cook" ? "Home Cook" : "Premium Vendor"}
                            </Badge>
                          )}
                        </div>
                        <p className="text-gray-600 mb-3 text-sm line-clamp-2">{request.message}</p>
                        {(request.amount_paid ?? request.final_price) && (
                          <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                            <DollarSign className="h-4 w-4" />
                            <span className="font-semibold">
                              ₦{(request.amount_paid ?? request.final_price ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{dayjs(request.created_at).format("MMM D, YYYY")}</span>
                          </div>
                          {request.paid_at && (
                            <div className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              <span>Paid {dayjs(request.paid_at).fromNow()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => router.push(`/explore/service-responses`)}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      View Conversation
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Regular Orders Section */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Menu Orders</h2>
          {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <ShoppingBag className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {orders.length === 0
                ? "No orders yet"
                : "No orders match your filter"}
            </h3>
            <p className="text-gray-600 mb-6">
              {orders.length === 0
                ? "Start ordering delicious meals from our vendors!"
                : "Try adjusting your filter criteria"}
            </p>
            {orders.length === 0 && (
              <Button
                onClick={() => router.push("/explore")}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Explore Menu
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredOrders.map((order) => (
              <Card
                key={order.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Order Header */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={getStatusBadge(order.status)}>
                        {getStatusIcon(order.status)}
                        {order.status}
                      </span>
                      <span className="text-sm text-gray-500">
                        {dayjs(order.created_at).format("MMM DD, YYYY • hh:mm A")}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {dayjs(order.created_at).fromNow()}
                    </span>
                  </div>
                </div>

                {/* Order Content */}
                <CardContent className="p-6">
                  {/* Product Info */}
                  <div className="flex gap-4 mb-4">
                    <div className="relative w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 bg-gray-100">
                      {order.menu_items?.image_url ? (
                        <Image
                          src={order.menu_items.image_url}
                          alt={order.menu_items.title || "Product"}
                          fill
                          className="object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                          }}
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100">
                          <Package className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
                        {order.menu_items?.title || "Product Unavailable"}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <User className="h-4 w-4" />
                        <span className="font-medium">
                          {order.vendors?.name || "Unknown Vendor"}
                        </span>
                        {order.vendors?.location && (
                          <span className="text-gray-400">
                            • {order.vendors.location}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Package className="h-4 w-4" />
                          Qty: {order.quantity}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          ₦{order.total_price.toLocaleString("en-NG", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      {order.delivery_charge && order.delivery_charge > 0 && (
                        <div className="mt-2 text-xs text-blue-600 flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          Delivery: ₦{order.delivery_charge.toLocaleString("en-NG", {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                      )}
                      {order.payment_reference && (
                        <div className="mt-2 text-xs text-green-600 font-semibold flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Paid - Ref: {order.payment_reference.substring(0, 12)}...
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Delivery Information */}
                  {(order.delivery_address_line_1 || order.delivery_city || order.delivery_state) && (
                    <div className="pt-4 border-t border-gray-100">
                      <div className="flex items-start gap-2 text-sm text-gray-600">
                        <Package className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 mb-1">Delivery Address:</p>
                          <p className="text-gray-600">
                            {order.delivery_address_line_1}
                            {order.delivery_city && order.delivery_state && (
                              <span>, {order.delivery_city}, {order.delivery_state}</span>
                            )}
                            {order.delivery_postal_code && (
                              <span> {order.delivery_postal_code}</span>
                            )}
                          </p>
                          {order.delivery_phone_number && (
                            <p className="text-gray-600 mt-1">
                              Phone: {order.delivery_phone_number}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Order Details */}
                  <div className="pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span>
                          Ordered: {dayjs(order.created_at).format("MMM DD, YYYY")}
                        </span>
                      </div>
                      {order.updated_at !== order.created_at && (
                        <span className="text-gray-400 text-xs">
                          Updated {dayjs(order.updated_at).fromNow()}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
