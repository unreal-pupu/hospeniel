"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isChefOrHomeCookVendorCategory } from "@/lib/vendorCategories";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

interface ServiceRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  vendorName: string;
  /** Drives chef vs general copy only (wording). */
  vendorCategory?: string | null;
}

export default function ServiceRequestDialog({
  open,
  onOpenChange,
  vendorId,
  vendorName,
  vendorCategory = null,
}: ServiceRequestDialogProps) {
  const [message, setMessage] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isChefOrHomeCook = isChefOrHomeCookVendorCategory(vendorCategory);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setError("Please log in to submit a service request.");
        setSubmitting(false);
        return;
      }

      if (!message.trim()) {
        setError("Please enter your message.");
        setSubmitting(false);
        return;
      }

      const { data: insertData, error: insertError } = await supabase
        .from("service_requests")
        .insert([
          {
            user_id: user.id,
            vendor_id: vendorId,
            message: message.trim(),
            contact_info: contactInfo.trim() || null,
            status: "New",
          },
        ])
        .select()
        .single();

      if (insertError) {
        console.error("❌ Error submitting service request:", insertError);
        setError(insertError.message || "Failed to submit request. Please try again.");
        setSubmitting(false);
        return;
      }

      if (insertData.vendor_id !== vendorId) {
        console.error("❌ CRITICAL: Service request vendor_id mismatch!", {
          expected: vendorId,
          actual: insertData.vendor_id,
        });
      }

      setSuccess(true);
      setMessage("");
      setContactInfo("");

      setTimeout(() => {
        setSuccess(false);
        onOpenChange(false);
      }, 2000);
    } catch (err) {
      console.error("Error submitting service request:", err);
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setMessage("");
      setContactInfo("");
      setError(null);
      setSuccess(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request Service from {vendorName}</DialogTitle>
          <DialogDescription>
            {isChefOrHomeCook
              ? "Send a message to request cooking services, meal preparation, or catering"
              : "Send a message to request catering, events, or other services"}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Request Submitted!</h3>
            <p className="text-gray-600">
              Your service request has been sent to {vendorName}. They will respond soon.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div>
              <Label htmlFor="message">
                Message <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  isChefOrHomeCook
                    ? "Describe the service you need (e.g., meal for 10 people on Saturday, cooking for a party, special dietary requirements, etc.)"
                    : "Describe the service you need (e.g., catering for 50 people, outdoor event setup, etc.)"
                }
                rows={6}
                className="mt-1"
                required
                disabled={submitting}
              />
              <p className="text-xs text-gray-500 mt-1">
                {isChefOrHomeCook
                  ? "Include details about your meal needs, date, number of people, location, and any special dietary requirements."
                  : "Include details about your event, date, number of guests, and any special requirements."}
              </p>
            </div>

            <div>
              <Label htmlFor="contactInfo">Contact Information (Optional)</Label>
              <Input
                id="contactInfo"
                type="text"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="Phone number or additional contact details"
                className="mt-1"
                disabled={submitting}
              />
              <p className="text-xs text-gray-500 mt-1">
                Your email from your account will be shared automatically.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700">
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
