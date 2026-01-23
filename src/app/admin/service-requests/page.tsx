"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface ServiceRequest {
  id: string;
  user_id: string;
  vendor_id: string;
  message: string;
  contact_info: string | null;
  status: string;
  final_price: number | null;
  price_confirmed: boolean | null;
  payment_status: string | null;
  amount_paid: number | null;
  payment_reference: string | null;
  payment_method: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at?: string | null;
  user_profile?: { name: string; email: string };
  vendor_profile?: { name: string; category?: string | null };
}

export default function AdminServiceRequestsPage() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchRequests = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setRequests([]);
        return;
      }

      const response = await fetch(`/api/admin/service-requests?status=${statusFilter}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        console.error("Error fetching service requests:", await response.text());
        setRequests([]);
        return;
      }

      const data = await response.json();
      setRequests(data.requests || []);
    } catch (error) {
      console.error("Error fetching service requests:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const updateStatus = async (requestId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("service_requests")
        .update({ status: newStatus })
        .eq("id", requestId);

      if (error) throw error;
      fetchRequests();
    } catch (error) {
      console.error("Error updating request:", error);
      alert("Failed to update request status");
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
        <h1 className="text-3xl font-bold text-gray-900">Service Requests</h1>
        <p className="text-gray-600 mt-2">View and manage all service requests</p>
      </div>

      <Card>
        <CardHeader>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="New">New</SelectItem>
              <SelectItem value="Viewed">Viewed</SelectItem>
              <SelectItem value="Responded">Responded</SelectItem>
              <SelectItem value="Price_Confirmed">Price Confirmed</SelectItem>
              <SelectItem value="Paid">Paid</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {requests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No service requests found
              </div>
            ) : (
              requests.map((request) => (
                <Card key={request.id} className="border-l-4 border-l-indigo-500">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">
                          Request from {request.user_profile?.name || "User"}
                        </CardTitle>
                        <p className="text-sm text-gray-600 mt-1">
                          To: {request.vendor_profile?.name || "Vendor"}
                          {request.vendor_profile?.category ? ` (${request.vendor_profile.category})` : ""}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          request.status === "Completed"
                            ? "bg-green-100 text-green-800"
                            : request.status === "Responded"
                            ? "bg-blue-100 text-blue-800"
                            : request.status === "Viewed"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {request.status}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Message:</p>
                        <p className="text-gray-900 mt-1 whitespace-pre-wrap">{request.message}</p>
                      </div>
                      {request.contact_info && (
                        <div>
                          <p className="text-sm font-medium text-gray-700">Contact Info:</p>
                          <p className="text-gray-900 mt-1">{request.contact_info}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Price:</p>
                          <p className="text-gray-900 mt-1">
                            {request.final_price ? `₦${request.final_price.toLocaleString("en-NG", { minimumFractionDigits: 2 })}` : "Not set"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Payment Status:</p>
                          <p className="text-gray-900 mt-1">
                            {request.payment_status || "pending"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Amount Paid:</p>
                          <p className="text-gray-900 mt-1">
                            {request.amount_paid
                              ? `₦${request.amount_paid.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
                              : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Paid At:</p>
                          <p className="text-gray-900 mt-1">
                            {request.paid_at ? new Date(request.paid_at).toLocaleString() : "N/A"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-sm text-gray-600">
                          {new Date(request.created_at).toLocaleString()}
                        </span>
                        <div className="flex gap-2">
                          <Select
                            value={request.status}
                            onValueChange={(value) => updateStatus(request.id, value)}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="New">New</SelectItem>
                              <SelectItem value="Viewed">Viewed</SelectItem>
                              <SelectItem value="Responded">Responded</SelectItem>
                              <SelectItem value="Price_Confirmed">Price Confirmed</SelectItem>
                              <SelectItem value="Paid">Paid</SelectItem>
                              <SelectItem value="Completed">Completed</SelectItem>
                              <SelectItem value="Cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Showing {requests.length} service requests
          </div>
        </CardContent>
      </Card>
    </div>
  );
}





