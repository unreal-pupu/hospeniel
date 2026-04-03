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
  phone_number?: string | null;
  subscription_plan: string;
  is_premium: boolean;
  approval_status: "pending" | "approved" | "rejected" | null;
  created_at: string;
  verified?: boolean;
}

interface VendorPurchasedTool {
  id: string;
  tool_name: string;
  status: string;
  purchase_date: string;
  expiry_date: string;
}

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [updatingApproval, setUpdatingApproval] = useState<string | null>(null);
  const [updatingVerification, setUpdatingVerification] = useState<string | null>(null);
  const [toolsByVendorId, setToolsByVendorId] = useState<Record<string, VendorPurchasedTool[]>>({});

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchPremiumToolsForVendors = async (vendorIds: string[]) => {
    if (vendorIds.length === 0) {
      setToolsByVendorId({});
      return;
    }
    try {
      const { data, error } = await supabase
        .from("vendor_purchased_tools")
        .select("id, vendor_id, tool_name, status, purchase_date, expiry_date")
        .in("vendor_id", vendorIds)
        .order("expiry_date", { ascending: false });

      if (error) {
        console.error("Error fetching vendor premium tools:", error);
        setToolsByVendorId({});
        return;
      }

      const rows = (data || []) as (VendorPurchasedTool & { vendor_id: string })[];
      const byVendor: Record<string, VendorPurchasedTool[]> = {};
      for (const row of rows) {
        const { vendor_id, ...tool } = row;
        if (!byVendor[vendor_id]) byVendor[vendor_id] = [];
        byVendor[vendor_id].push(tool);
      }
      setToolsByVendorId(byVendor);
    } catch (err) {
      console.error("Error building premium tools map:", err);
      setToolsByVendorId({});
    }
  };

  const fetchVendors = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "vendor")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const vendorProfiles = (data || []) as Vendor[];

      const profileIds = vendorProfiles.map((v) => v.id);
      const vendorPhoneByProfileId = new Map<string, string>();

      if (profileIds.length > 0) {
        const { data: vendorRows, error: vendorsError } = await supabase
          .from("vendors")
          .select("profile_id, phone_number")
          .in("profile_id", profileIds);

        if (vendorsError) {
          console.error("Error fetching vendor phone numbers:", vendorsError);
        } else if (vendorRows) {
          for (const row of vendorRows as { profile_id: string; phone_number: string | null }[]) {
            const t = row.phone_number?.trim();
            if (t && !vendorPhoneByProfileId.has(row.profile_id)) {
              vendorPhoneByProfileId.set(row.profile_id, t);
            }
          }
        }
      }

      const merged = vendorProfiles.map((vendor) => {
        const fromProfile = vendor.phone_number?.trim() || "";
        const fromVendorRow = vendorPhoneByProfileId.get(vendor.id)?.trim() || "";
        const resolved = fromProfile || fromVendorRow || null;
        return {
          ...vendor,
          verified: vendor.verified ?? false,
          phone_number: resolved,
        };
      });

      setVendors(merged);
      await fetchPremiumToolsForVendors(merged.map((v) => v.id));
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

  const updateVerificationStatus = async (vendor: Vendor, verified: boolean) => {
    setUpdatingVerification(vendor.id);
    try {
      console.log("[Admin Vendors] Updating verification", {
        profileId: vendor.id,
        verified,
      });

      const { data, error } = await supabase
        .from("profiles")
        .update({ verified })
        .eq("id", vendor.id)
        .select("id, verified");

      if (error) {
        console.error("[Admin Vendors] Verification update failed", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }

      if (!data || data.length === 0) {
        alert("No vendor profile found to update verification status.");
        console.warn("[Admin Vendors] Verification update returned no rows", {
          profileId: vendor.id,
          verified,
        });
        return;
      }

      if (data.length > 1) {
        console.warn("[Admin Vendors] Verification update returned multiple rows", {
          rows: data.map((row: { id: string }) => row.id),
          profileId: vendor.id,
        });
      }

      setVendors((prev) =>
        prev.map((item) =>
          item.id === vendor.id ? { ...item, verified: data[0]?.verified ?? verified } : item
        )
      );
      alert(`Vendor verification ${verified ? "enabled" : "removed"} successfully.`);
    } catch (error) {
      console.error("Error updating vendor verification:", error);
      alert("Failed to update vendor verification");
    } finally {
      setUpdatingVerification(null);
    }
  };

  const formatPhoneDisplay = (phone: string | null | undefined) => {
    const t = phone?.trim();
    if (!t) return "N/A";
    return t;
  };

  const getCategoryLabel = (category: string | null) => {
    if (!category) return "N/A";
    return category
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const formatToolDateRange = (purchaseDate: string, expiryDate: string) => {
    const p = new Date(purchaseDate);
    const e = new Date(expiryDate);
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return `${fmt(p)} → ${fmt(e)}`;
  };

  const isToolActive = (expiryDateIso: string) =>
    new Date(expiryDateIso).getTime() > Date.now();

  const renderPremiumToolsCell = (vendorId: string) => {
    const tools = toolsByVendorId[vendorId];
    if (!tools || tools.length === 0) {
      return (
        <span className="text-gray-500 text-sm italic">No active tools</span>
      );
    }
    return (
      <div className="flex flex-col gap-1.5 max-w-[220px]">
        {tools.map((tool) => {
          const active = isToolActive(tool.expiry_date);
          return (
            <div
              key={tool.id}
              className="flex flex-wrap items-center gap-1.5 text-xs"
            >
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 font-medium truncate max-w-[120px]">
                {tool.tool_name}
              </span>
              <span
                className={`shrink-0 px-2 py-0.5 rounded-full font-semibold ${
                  active ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-600"
                }`}
              >
                {active ? "Active" : "Expired"}
              </span>
              <span className="text-gray-500 shrink-0">
                {formatToolDateRange(tool.purchase_date, tool.expiry_date)}
              </span>
            </div>
          );
        })}
      </div>
    );
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
    const q = searchTerm.toLowerCase();
    const phoneDigits = vendor.phone_number?.replace(/\D/g, "") ?? "";
    const searchDigits = searchTerm.replace(/\D/g, "");
    const matchesSearch =
      vendor.name?.toLowerCase().includes(q) ||
      vendor.email?.toLowerCase().includes(q) ||
      vendor.location?.toLowerCase().includes(q) ||
      vendor.phone_number?.toLowerCase().includes(q) ||
      (searchDigits.length > 0 && phoneDigits.includes(searchDigits));
    
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
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 min-w-[8rem] whitespace-nowrap">
                    Phone Number
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Category</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Location</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Plan</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Premium Tools</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVendors.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-gray-500">
                      No vendors found
                    </td>
                  </tr>
                ) : (
                  filteredVendors.map((vendor) => (
                    <tr key={vendor.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span>{vendor.name || "N/A"}</span>
                          {vendor.verified && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                              Verified
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">{vendor.email}</td>
                      <td className="py-3 px-4 align-top">
                        {vendor.phone_number ? (
                          <a
                            href={`tel:${vendor.phone_number.replace(/\s/g, "")}`}
                            className="font-mono text-sm text-indigo-700 hover:underline tabular-nums break-all"
                          >
                            {formatPhoneDisplay(vendor.phone_number)}
                          </a>
                        ) : (
                          <span className="text-gray-500 text-sm">N/A</span>
                        )}
                      </td>
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
                      <td className="py-3 px-4 align-top">
                        {renderPremiumToolsCell(vendor.id)}
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
                          <Button
                            size="sm"
                            variant={vendor.verified ? "outline" : "default"}
                            onClick={() => updateVerificationStatus(vendor, !vendor.verified)}
                            disabled={updatingVerification === vendor.id}
                            className={vendor.verified ? "border-blue-500 text-blue-600" : "bg-blue-600 hover:bg-blue-700 text-white"}
                          >
                            {updatingVerification === vendor.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : vendor.verified ? (
                              "Remove Verification"
                            ) : (
                              "Verify Vendor"
                            )}
                          </Button>
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





