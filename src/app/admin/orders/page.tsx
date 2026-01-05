"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Search, Filter, Package, User, Store, MapPin, Edit } from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe",
  "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
  "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau",
  "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"
];

interface Order {
  id: string;
  vendor_id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  total_price: number;
  status: string;
  payment_reference: string | null;
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
    image_url: string | null;
    price: number;
  };
  profiles?: {
    id: string;
    name: string;
    email: string;
  };
  vendor_profiles?: {
    id: string;
    name: string;
    business_name: string;
    image_url: string | null;
    location: string | null;
  };
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "amount" | "status">("date");
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  
  // Delivery info dialog state
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [deliveryForm, setDeliveryForm] = useState({
    delivery_address_line_1: "",
    delivery_city: "",
    delivery_state: "",
    delivery_postal_code: "",
    delivery_phone_number: "",
  });
  const [updatingDelivery, setUpdatingDelivery] = useState(false);

  useEffect(() => {
    fetchOrders();
    
    // Set up real-time subscription for orders
    const channel = supabase
      .channel("admin-orders-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          console.log("🔄 Admin Orders: Change detected:", payload);
          // Small delay to ensure database is ready
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
  }, [statusFilter]);

  useEffect(() => {
    applyFiltersAndSort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, statusFilter, searchQuery, sortBy]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/admin/orders?status=${statusFilter}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      } else {
        console.error("Error fetching orders:", await response.text());
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...orders];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((order) => {
        return (
          order.id.toLowerCase().includes(query) ||
          order.profiles?.name?.toLowerCase().includes(query) ||
          order.profiles?.email?.toLowerCase().includes(query) ||
          order.vendor_profiles?.name?.toLowerCase().includes(query) ||
          order.vendor_profiles?.business_name?.toLowerCase().includes(query) ||
          order.menu_items?.title?.toLowerCase().includes(query) ||
          order.status?.toLowerCase().includes(query)
        );
      });
    }

    // Apply status filter (already applied in API, but keep for client-side filtering if needed)
    if (statusFilter !== "all") {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "amount":
          return b.total_price - a.total_price;
        case "status":
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });

    setFilteredOrders(filtered);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      setUpdatingOrderId(orderId);
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) throw error;
      await fetchOrders();
    } catch (error) {
      console.error("Error updating order:", error);
      alert("Failed to update order status");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const openDeliveryDialog = (order: Order) => {
    setSelectedOrder(order);
    setDeliveryForm({
      delivery_address_line_1: order.delivery_address_line_1 || "",
      delivery_city: order.delivery_city || "",
      delivery_state: order.delivery_state || "",
      delivery_postal_code: order.delivery_postal_code || "",
      delivery_phone_number: order.delivery_phone_number || "",
    });
    setDeliveryDialogOpen(true);
  };

  const closeDeliveryDialog = () => {
    setDeliveryDialogOpen(false);
    setSelectedOrder(null);
    setDeliveryForm({
      delivery_address_line_1: "",
      delivery_city: "",
      delivery_state: "",
      delivery_postal_code: "",
      delivery_phone_number: "",
    });
  };

  const updateDeliveryInfo = async () => {
    if (!selectedOrder) return;

    // Validate required fields
    if (!deliveryForm.delivery_address_line_1 || !deliveryForm.delivery_city || !deliveryForm.delivery_state) {
      alert("Please fill in all required fields (Address, City, State)");
      return;
    }

    setUpdatingDelivery(true);
    try {
      const response = await fetch(`/api/admin/update-delivery/${selectedOrder.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...deliveryForm,
          user_id: selectedOrder.user_id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to update delivery information");
      }

      alert("Delivery information updated successfully!");
      closeDeliveryDialog();
      await fetchOrders();
    } catch (error: any) {
      console.error("Error updating delivery info:", error);
      alert(error.message || "Failed to update delivery information");
    } finally {
      setUpdatingDelivery(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "Completed":
      case "Paid":
        return "bg-green-100 text-green-800";
      case "Pending":
        return "bg-yellow-100 text-yellow-800";
      case "Accepted":
      case "Confirmed":
        return "bg-blue-100 text-blue-800";
      case "Cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Calculate stats from ALL orders (not filtered)
  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === "Pending").length,
    paid: orders.filter((o) => o.status === "Paid").length,
    confirmed: orders.filter((o) => o.status === "Confirmed").length,
    accepted: orders.filter((o) => o.status === "Accepted").length,
    completed: orders.filter((o) => o.status === "Completed").length,
    rejected: orders.filter((o) => o.status === "Rejected").length,
    cancelled: orders.filter((o) => o.status === "Cancelled").length,
    totalRevenue: orders
      .filter((o) => o.status === "Paid" || o.status === "Completed" || o.status === "Confirmed")
      .reduce((sum, o) => sum + (Number(o.total_price) || 0), 0),
  };

  if (loading) {
    return (
      <div className="w-full flex flex-col items-center justify-center min-h-[400px] bg-hospineil-base-bg">
        <Loader2 className="animate-spin text-hospineil-primary h-8 w-8 mb-4" />
        <p className="text-gray-600 font-body">Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-hospineil-primary mb-2 font-header">
          Orders Management
        </h1>
        <p className="text-gray-600 font-body">View and manage all user orders</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
        <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-body mb-1">Total Orders</p>
            <p className="text-2xl font-bold text-hospineil-primary font-header">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-body mb-1">Pending</p>
            <p className="text-2xl font-bold text-yellow-600 font-header">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-body mb-1">Paid/Confirmed</p>
            <p className="text-2xl font-bold text-blue-600 font-header">{stats.paid + stats.confirmed}</p>
          </CardContent>
        </Card>
        <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-body mb-1">Completed</p>
            <p className="text-2xl font-bold text-green-600 font-header">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-body mb-1">Total Revenue</p>
            <p className="text-2xl font-bold text-hospineil-accent font-header">
              ₦{stats.totalRevenue.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-body mb-1">Accepted</p>
            <p className="text-xl font-bold text-indigo-600 font-header">{stats.accepted}</p>
          </CardContent>
        </Card>
        <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-body mb-1">Rejected</p>
            <p className="text-xl font-bold text-red-600 font-header">{stats.rejected}</p>
          </CardContent>
        </Card>
        <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-body mb-1">Cancelled</p>
            <p className="text-xl font-bold text-gray-600 font-header">{stats.cancelled}</p>
          </CardContent>
        </Card>
        <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600 font-body mb-1">Active Orders</p>
            <p className="text-xl font-bold text-purple-600 font-header">
              {stats.pending + stats.paid + stats.confirmed + stats.accepted}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200 mb-6">
        <CardHeader>
          <CardTitle className="text-hospineil-primary font-header">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                type="text"
                placeholder="Search by order ID, customer, vendor, or product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-hospineil-base-bg border-gray-300 focus:ring-hospineil-primary focus:border-hospineil-primary font-body"
              />
            </div>

            {/* Status Filter */}
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-hospineil-base-bg border-gray-300 focus:ring-hospineil-primary focus:border-hospineil-primary font-body">
                  <Filter className="h-4 w-4 mr-2 text-hospineil-primary" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-lg shadow-lg border border-gray-200">
                  <SelectItem value="all" className="font-body hover:bg-gray-100">All Statuses</SelectItem>
                  <SelectItem value="Pending" className="font-body hover:bg-gray-100">Pending</SelectItem>
                  <SelectItem value="Paid" className="font-body hover:bg-gray-100">Paid</SelectItem>
                  <SelectItem value="Accepted" className="font-body hover:bg-gray-100">Accepted</SelectItem>
                  <SelectItem value="Confirmed" className="font-body hover:bg-gray-100">Confirmed</SelectItem>
                  <SelectItem value="Completed" className="font-body hover:bg-gray-100">Completed</SelectItem>
                  <SelectItem value="Cancelled" className="font-body hover:bg-gray-100">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort By */}
            <div className="w-full md:w-48">
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as "date" | "amount" | "status")}>
                <SelectTrigger className="bg-hospineil-base-bg border-gray-300 focus:ring-hospineil-primary focus:border-hospineil-primary font-body">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-lg shadow-lg border border-gray-200">
                  <SelectItem value="date" className="font-body hover:bg-gray-100">Date (Newest)</SelectItem>
                  <SelectItem value="amount" className="font-body hover:bg-gray-100">Amount (High to Low)</SelectItem>
                  <SelectItem value="status" className="font-body hover:bg-gray-100">Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200">
        <CardHeader>
          <CardTitle className="text-hospineil-primary font-header">
            Orders ({filteredOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <p className="text-gray-600 text-lg font-body">No orders found</p>
              <p className="text-gray-500 text-sm font-body mt-2">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Orders will appear here when customers place them"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-hospineil-primary font-header">Order ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-hospineil-primary font-header">Customer</th>
                    <th className="text-left py-3 px-4 font-semibold text-hospineil-primary font-header">Vendor</th>
                    <th className="text-left py-3 px-4 font-semibold text-hospineil-primary font-header">Product</th>
                    <th className="text-left py-3 px-4 font-semibold text-hospineil-primary font-header">Quantity</th>
                    <th className="text-left py-3 px-4 font-semibold text-hospineil-primary font-header">Amount</th>
                    <th className="text-left py-3 px-4 font-semibold text-hospineil-primary font-header">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-hospineil-primary font-header">Delivery</th>
                    <th className="text-left py-3 px-4 font-semibold text-hospineil-primary font-header">Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-hospineil-primary font-header">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-gray-200 hover:bg-hospineil-base-bg transition-colors"
                    >
                      <td className="py-3 px-4 text-sm font-mono text-gray-600 font-body">
                        {order.id.substring(0, 8)}...
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-hospineil-primary" />
                          <div>
                            <div className="font-medium text-gray-800 font-body">
                              {order.profiles?.name || "N/A"}
                            </div>
                            <div className="text-xs text-gray-500 font-body">
                              {order.profiles?.email || "N/A"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-hospineil-accent" />
                          <div>
                            <div className="font-medium text-gray-800 font-body">
                              {order.vendor_profiles?.business_name || order.vendor_profiles?.name || "N/A"}
                            </div>
                            {order.vendor_profiles?.location && (
                              <div className="text-xs text-gray-500 font-body">
                                📍 {order.vendor_profiles.location}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-800 font-body">
                          {order.menu_items?.title || "N/A"}
                        </div>
                        {order.menu_items?.price && (
                          <div className="text-xs text-gray-500 font-body">
                            ₦{order.menu_items.price.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600 font-body">{order.quantity}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-hospineil-primary font-header">
                          ₦{order.total_price.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                        </div>
                        {order.delivery_charge && order.delivery_charge > 0 && (
                          <div className="text-xs text-gray-500 font-body">
                            Delivery: ₦{order.delivery_charge.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                          </div>
                        )}
                        {order.payment_reference && (
                          <div className="text-xs text-gray-500 font-body">Ref: {order.payment_reference.substring(0, 8)}...</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold font-button ${getStatusBadgeColor(
                            order.status
                          )}`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {order.delivery_address_line_1 || order.delivery_city || order.delivery_state ? (
                          <div className="text-xs text-gray-600 font-body">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate max-w-[150px]">
                                {order.delivery_city && order.delivery_state
                                  ? `${order.delivery_city}, ${order.delivery_state}`
                                  : order.delivery_address_line_1 || "N/A"}
                              </span>
                            </div>
                            {order.delivery_phone_number && (
                              <div className="text-gray-500 mt-1">{order.delivery_phone_number}</div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 font-body italic">Not set</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-gray-600 font-body">
                          {dayjs(order.created_at).format("MMM DD, YYYY")}
                        </div>
                        <div className="text-xs text-gray-500 font-body">
                          {dayjs(order.created_at).format("hh:mm A")}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-2">
                          <Select
                            value={order.status}
                            onValueChange={(value) => updateOrderStatus(order.id, value)}
                            disabled={updatingOrderId === order.id}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs bg-hospineil-base-bg border-gray-300 focus:ring-hospineil-primary font-body">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white rounded-lg shadow-lg border border-gray-200">
                              <SelectItem value="Pending" className="font-body hover:bg-gray-100">Pending</SelectItem>
                              <SelectItem value="Paid" className="font-body hover:bg-gray-100">Paid</SelectItem>
                              <SelectItem value="Accepted" className="font-body hover:bg-gray-100">Accepted</SelectItem>
                              <SelectItem value="Confirmed" className="font-body hover:bg-gray-100">Confirmed</SelectItem>
                              <SelectItem value="Completed" className="font-body hover:bg-gray-100">Completed</SelectItem>
                              <SelectItem value="Cancelled" className="font-body hover:bg-gray-100">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeliveryDialog(order)}
                            className="w-full text-xs h-7"
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Delivery
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delivery Info Update Dialog */}
      <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Delivery Information</DialogTitle>
            <DialogDescription>
              Update delivery details for order {selectedOrder?.id.substring(0, 8)}...
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="delivery_address_line_1" className="text-sm font-medium text-gray-700">
                Street Address <span className="text-red-500">*</span>
              </Label>
              <Input
                id="delivery_address_line_1"
                value={deliveryForm.delivery_address_line_1}
                onChange={(e) =>
                  setDeliveryForm({ ...deliveryForm, delivery_address_line_1: e.target.value })
                }
                placeholder="Enter street address"
                className="mt-1 bg-hospineil-light-bg border-gray-300 focus:ring-2 focus:ring-hospineil-primary"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="delivery_city" className="text-sm font-medium text-gray-700">
                  City <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="delivery_city"
                  value={deliveryForm.delivery_city}
                  onChange={(e) =>
                    setDeliveryForm({ ...deliveryForm, delivery_city: e.target.value })
                  }
                  placeholder="Enter city"
                  className="mt-1 bg-hospineil-light-bg border-gray-300 focus:ring-2 focus:ring-hospineil-primary"
                  required
                />
              </div>

              <div>
                <Label htmlFor="delivery_state" className="text-sm font-medium text-gray-700">
                  State <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={deliveryForm.delivery_state}
                  onValueChange={(value) =>
                    setDeliveryForm({ ...deliveryForm, delivery_state: value })
                  }
                >
                  <SelectTrigger className="mt-1 bg-hospineil-light-bg border-gray-300 focus:ring-2 focus:ring-hospineil-primary">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {NIGERIAN_STATES.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="delivery_postal_code" className="text-sm font-medium text-gray-700">
                  Postal Code
                </Label>
                <Input
                  id="delivery_postal_code"
                  value={deliveryForm.delivery_postal_code}
                  onChange={(e) =>
                    setDeliveryForm({ ...deliveryForm, delivery_postal_code: e.target.value })
                  }
                  placeholder="Enter postal code"
                  className="mt-1 bg-hospineil-light-bg border-gray-300 focus:ring-2 focus:ring-hospineil-primary"
                />
              </div>

              <div>
                <Label htmlFor="delivery_phone_number" className="text-sm font-medium text-gray-700">
                  Phone Number
                </Label>
                <Input
                  id="delivery_phone_number"
                  type="tel"
                  value={deliveryForm.delivery_phone_number}
                  onChange={(e) =>
                    setDeliveryForm({ ...deliveryForm, delivery_phone_number: e.target.value.replace(/[^\d+]/g, "") })
                  }
                  placeholder="e.g., +2348012345678"
                  className="mt-1 bg-hospineil-light-bg border-gray-300 focus:ring-2 focus:ring-hospineil-primary"
                />
              </div>
            </div>

            {selectedOrder && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Updating delivery information will also update the user's profile and recalculate the delivery charge for this order.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeDeliveryDialog}
              disabled={updatingDelivery}
            >
              Cancel
            </Button>
            <Button
              onClick={updateDeliveryInfo}
              disabled={updatingDelivery}
              className="bg-hospineil-primary hover:bg-hospineil-accent"
            >
              {updatingDelivery ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Updating...
                </>
              ) : (
                "Update Delivery Info"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
