"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, Save } from "lucide-react";

interface RiderPaymentDetails {
  account_name: string;
  bank_name: string;
  account_number: string;
}

export default function RiderPaymentDetailsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<RiderPaymentDetails>({
    account_name: "",
    bank_name: "",
    account_number: "",
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchPaymentDetails();
  }, []);

  async function fetchPaymentDetails() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("rider_payment_details")
        .select("account_name, bank_name, account_number")
        .eq("rider_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setDetails({
          account_name: data.account_name || "",
          bank_name: data.bank_name || "",
          account_number: data.account_number || "",
        });
      }
    } catch (error) {
      console.error("Error fetching payment details:", error);
      alert("Failed to load payment details.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const payload = {
        rider_id: user.id,
        account_name: details.account_name.trim(),
        bank_name: details.bank_name.trim(),
        account_number: details.account_number.trim(),
      };

      const { data, error } = await supabase
        .from("rider_payment_details")
        .upsert(payload, { onConflict: "rider_id" })
        .select("account_name, bank_name, account_number")
        .single();

      if (error) throw error;

      if (data) {
        setDetails({
          account_name: data.account_name || "",
          bank_name: data.bank_name || "",
          account_number: data.account_number || "",
        });
      }

      setMessage({ type: "success", text: "Payment details saved successfully!" });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Error saving payment details:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save payment details.";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setSaving(false);
    }
  }

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
        <h1 className="text-3xl font-bold text-gray-900">Payment Details</h1>
        <p className="text-gray-600 mt-2">Manage your payout account information.</p>
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <p className="text-blue-800">
            These details are used for weekly payouts by the admin.
          </p>
        </CardContent>
      </Card>

      {message && (
        <Card className={message.type === "success" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              {message.type === "success" && <CheckCircle className="h-5 w-5 text-green-600" />}
              <p className={message.type === "success" ? "text-green-800" : "text-red-800"}>
                {message.text}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSave}>
        <Card>
          <CardHeader>
            <CardTitle>Bank Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="account_name">Account Name</Label>
              <Input
                id="account_name"
                value={details.account_name}
                onChange={(event) => setDetails({ ...details, account_name: event.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="bank_name">Bank Name</Label>
              <Input
                id="bank_name"
                value={details.bank_name}
                onChange={(event) => setDetails({ ...details, bank_name: event.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="account_number">Account Number</Label>
              <Input
                id="account_number"
                value={details.account_number}
                onChange={(event) => setDetails({ ...details, account_number: event.target.value })}
                required
              />
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="bg-hospineil-primary text-white hover:bg-hospineil-primary/90"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Save Details
                </span>
              )}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
