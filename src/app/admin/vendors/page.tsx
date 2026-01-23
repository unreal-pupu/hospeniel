"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, Search, XCircle } from "lucide-react";
import { VENDOR_CATEGORIES } from "@/lib/vendorCategories";

interface Vendor {
  id: string;
  name: string;
  email: string;
  category: string;
  location: string;
  subscription_plan: string;
  is_premium: boolean;
  approval_status: "pending" | "approved" | "rejected" | null;
  created_at: string;
}

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [updatingApproval, setUpdatingApproval] = useState<string | null>(null);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "vendor")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error("Error fetching vendors:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateSubscription = async (vendorId: string, plan: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          subscription_plan: plan,
          is_premium: plan === "professional",
        })
        .eq("id", vendorId);

      if (error) throw error;
      fetchVendors();
    } catch (error) {
      console.error("Error updating subscription:", error);
      alert("Failed to update subscription");
    }
  };

  const updateApprovalStatus = async (vendorId: string, status: "approved" | "rejected") => {
    setUpdatingApproval(vendorId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ approval_status: status })
        .eq("id", vendorId);

      if (error) throw error;

      const vendor = vendors.find((v) => v.id === vendorId);
      if (vendor) {
        const { error: notificationError } = await supabase
          .from("notifications")
          .insert({
            vendor_id: vendorId,
            message: status === "approved"
              ? "Your vendor account has been approved! You can now access the vendor dashboard."
              : "Your vendor account application has been rejected. Please contact support for more information.",
            type: "system",
            read: false,
            metadata: {
              type: "vendor_approval",
              status,
            },
          });

        if (notificationError) {
          console.error("Error creating vendor notification:", notificationError);
        }
      }

      alert(`Vendor ${status === "approved" ? "approved" : "rejected"} successfully!`);
      fetchVendors();
    } catch (error) {
      console.error("Error updating vendor approval status:", error);
      alert("Failed to update vendor approval status");
    } finally {
      setUpdatingApproval(null);
    }
  };

  const getCategoryLabel = (category: string | null) => {
    if (!category) return "N/A";
    return category
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "approved":
        return (
          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
            Approved
          </span>
        );
      case "rejected":
        return (
          <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
            Rejected
          </span>
        );
      case "pending":
        return (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
            Pending
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold">
            Unknown
          </span>
        );
    }
  };

  const filteredVendors = vendors.filter((vendor) => {
    const matchesSearch =
      vendor.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.location?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory =
      categoryFilter === "all" || vendor.category === categoryFilter;

    const matchesStatus =
      statusFilter === "all" || vendor.approval_status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-indigo-600 h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vendors Management</h1>
          <p className="text-gray-600 mt-2">View and manage all vendor accounts</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search vendors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {VENDOR_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Category</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Location</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Plan</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVendors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500">
                      No vendors found
                    </td>
                  </tr>
                ) : (
                  filteredVendors.map((vendor) => (
                    <tr key={vendor.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{vendor.name || "N/A"}</td>
                      <td className="py-3 px-4">{vendor.email}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                          {getCategoryLabel(vendor.category)}
                        </span>
                      </td>
                      <td className="py-3 px-4">{vendor.location || "N/A"}</td>
                      <td className="py-3 px-4">{getStatusBadge(vendor.approval_status)}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            vendor.subscription_plan === "professional"
                              ? "bg-green-100 text-green-800"
                              : vendor.subscription_plan === "starter"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {vendor.subscription_plan || "free_trial"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {vendor.approval_status !== "approved" && (
                            <Button
                              size="sm"
                              onClick={() => updateApprovalStatus(vendor.id, "approved")}
                              disabled={updatingApproval === vendor.id}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              {updatingApproval === vendor.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Approve
                                </>
                              )}
                            </Button>
                          )}
                          {vendor.approval_status !== "rejected" && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => updateApprovalStatus(vendor.id, "rejected")}
                              disabled={updatingApproval === vendor.id}
                            >
                              {updatingApproval === vendor.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Reject
                                </>
                              )}
                            </Button>
                          )}
                          <Select
                            value={vendor.subscription_plan || "free_trial"}
                            onValueChange={(value) => updateSubscription(vendor.id, value)}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="free_trial">Free Trial</SelectItem>
                              <SelectItem value="starter">Starter</SelectItem>
                              <SelectItem value="professional">Professional</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredVendors.length} of {vendors.length} vendors
          </div>
        </CardContent>
      </Card>
    </div>
  );
}





