"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle, XCircle, Search, Filter, CreditCard, User } from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

interface Payment {
  id: string;
  user_id: string;
  total_amount: number;
  status: string;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    name: string;
    email: string;
  };
  orders?: Array<{
    id: string;
    vendor_id: string;
    product_id: string;
    quantity: number;
    total_price: number;
    status: string;
    vendor_name?: string;
    menu_items?: {
      title: string;
    };
  }>;
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "amount" | "status">("date");
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalCommission: 0,
    totalTax: 0,
    successfulPayments: 0,
    pendingPayments: 0,
    failedPayments: 0,
  });

  useEffect(() => {
    fetchPayments();
    
    // Set up real-time subscription for payments
    const channel = supabase
      .channel("admin-payments-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
        },
        (payload) => {
          console.log("🔄 Admin Payments: Change detected:", payload);
          // Small delay to ensure database is ready
          setTimeout(() => {
            fetchPayments();
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
  }, [payments, statusFilter, searchQuery, sortBy]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/admin/payments?status=${statusFilter}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPayments(data.payments || []);
        setSummary(data.summary || {
          totalRevenue: 0,
          totalCommission: 0,
          totalTax: 0,
          successfulPayments: 0,
          pendingPayments: 0,
          failedPayments: 0,
        });
      } else {
        console.error("Error fetching payments:", await response.text());
      }
    } catch (error) {
      console.error("Error fetching payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...payments];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((payment) => {
        return (
          payment.id.toLowerCase().includes(query) ||
          payment.payment_reference?.toLowerCase().includes(query) ||
          payment.profiles?.name?.toLowerCase().includes(query) ||
          payment.profiles?.email?.toLowerCase().includes(query) ||
          payment.status?.toLowerCase().includes(query)
        );
      });
    }

    // Apply status filter (already applied in API, but keep for client-side filtering if needed)
    if (statusFilter !== "all") {
      filtered = filtered.filter((payment) => payment.status === statusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "amount":
          return b.total_amount - a.total_amount;
        case "status":
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });

    setFilteredPayments(filtered);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="w-full flex flex-col items-center justify-center min-h-[400px] bg-hospineil-base-bg">
        <Loader2 className="animate-spin text-hospineil-primary h-8 w-8 mb-4" />
        <p className="text-gray-600 font-body">Loading payments...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-hospineil-primary mb-2 font-header">
          Payments Management
        </h1>
        <p className="text-gray-600 font-body">View and verify all payment transactions</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 font-body">Total Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-hospineil-primary font-header">
              {payments.length}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 font-body">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 font-header">
              ₦{summary.totalRevenue.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 font-body">Total Commission</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600 font-header">
              ₦{summary.totalCommission.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 font-body">Successful</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-hospineil-primary font-header">
              {summary.successfulPayments}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 font-body">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600 font-header">
              {summary.pendingPayments}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 font-body">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 font-header">
              {summary.failedPayments}
            </div>
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
                placeholder="Search by payment ID, reference, customer name or email..."
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
                  <SelectItem value="pending" className="font-body hover:bg-gray-100">Pending</SelectItem>
                  <SelectItem value="success" className="font-body hover:bg-gray-100">Success</SelectItem>
                  <SelectItem value="failed" className="font-body hover:bg-gray-100">Failed</SelectItem>
                  <SelectItem value="cancelled" className="font-body hover:bg-gray-100">Cancelled</SelectItem>
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

      {/* Payments Table */}
      <Card className="bg-hospineil-light-bg rounded-2xl shadow-md border border-gray-200">
        <CardHeader>
          <CardTitle className="text-hospineil-primary font-header">
            Payments ({filteredPayments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <p className="text-gray-600 text-lg font-body">No payments found</p>
              <p className="text-gray-500 text-sm font-body mt-2">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Payments will appear here when customers make transactions"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-hospineil-primary font-header">Transaction ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-hospineil-primary font-header">Vendor Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-hospineil-primary font-header">User Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-hospineil-primary font-header">Amount Paid</th>
                    <th className="text-left py-3 px-4 font-semibold text-hospineil-primary font-header">Commission Earned</th>
                    <th className="text-left py-3 px-4 font-semibold text-hospineil-primary font-header">Payment Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => {
                    // Calculate commission (10% of order total)
                    const COMMISSION_RATE = 0.10;
                    const orderTotal = payment.orders && payment.orders.length > 0
                      ? payment.orders.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0)
                      : Number(payment.total_amount || 0);
                    const commission = orderTotal * COMMISSION_RATE;
                    const vendorName = payment.orders && payment.orders.length > 0
                      ? payment.orders[0].vendor_name || "N/A"
                      : "N/A";

                    return (
                      <tr
                        key={payment.id}
                        className="border-b border-gray-200 hover:bg-hospineil-base-bg transition-colors"
                      >
                        <td className="py-3 px-4 text-sm font-mono text-gray-600 font-body">
                          {payment.payment_reference || payment.id.substring(0, 8) + "..."}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-800 font-body">
                            {vendorName}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-hospineil-primary" />
                            <div>
                              <div className="font-medium text-gray-800 font-body">
                                {payment.profiles?.name || "N/A"}
                              </div>
                              <div className="text-xs text-gray-500 font-body">
                                {payment.profiles?.email || "N/A"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-hospineil-primary font-header">
                            ₦{Number(payment.total_amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-green-600 font-header">
                            ₦{commission.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-600 font-body">
                            {dayjs(payment.created_at).format("MMM DD, YYYY")}
                          </div>
                          <div className="text-xs text-gray-500 font-body">
                            {dayjs(payment.created_at).format("hh:mm A")}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
