"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { validateEmail, getBaseUrl } from "@/lib/emailValidation";
import { Mail, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  const [emailError, setEmailError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setMessageType("info");
    setEmailError("");

    // Validate email format
    if (!email || email.trim().length === 0) {
      setEmailError("Email is required");
      return;
    }

    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      // Get dynamic redirect URL based on current environment
      const redirectUrl = `${getBaseUrl()}/reset-password`;

      // ✅ SECURITY: Send password reset email via Supabase Auth
      // Supabase handles:
      // - Email validation (checks if email exists in database)
      // - Rate limiting (prevents abuse)
      // - Secure token generation
      // - Email delivery
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
        // Optional: Customize email template
        // emailRedirectTo: redirectUrl,
      });

      setLoading(false);

      if (error) {
        // Handle specific error cases
        if (error.message.includes("rate limit") || error.message.includes("too many")) {
          setMessage("Too many requests. Please wait a few minutes before trying again.");
          setMessageType("error");
        } else if (error.message.includes("email") || error.message.includes("user")) {
          // Don't reveal if email exists for security (prevent email enumeration)
          setMessage("If an account exists with this email, a password reset link has been sent.");
          setMessageType("success");
        } else {
          setMessage(error.message || "An error occurred. Please try again.");
          setMessageType("error");
        }
      } else {
        // Success - always show success message (security: don't reveal if email exists)
        setMessage("If an account exists with this email, a password reset link has been sent. Please check your inbox and spam folder.");
        setMessageType("success");
        // Clear email field for security
        setEmail("");
      }
    } catch (err: any) {
      console.error("Error sending password reset email:", err);
      setLoading(false);
      setMessage("An unexpected error occurred. Please try again later.");
      setMessageType("error");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
      <Card className="w-full max-w-md shadow-lg rounded-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <Mail className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            Forgot Password
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError("");
                  setMessage("");
                }}
                required
                className={emailError ? "border-red-500" : ""}
                disabled={loading}
              />
              {emailError && (
                <p className="text-xs text-red-500">{emailError}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>

          {message && (
            <div
              className={`mt-4 p-3 rounded-lg text-sm ${
                messageType === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : messageType === "error"
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-blue-50 text-blue-700 border border-blue-200"
              }`}
            >
              {message}
            </div>
          )}

          <div className="mt-4 text-xs text-gray-500 text-center">
            <p>💡 Check your spam folder if you don't see the email.</p>
            <p className="mt-1">The reset link will expire in 1 hour.</p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-2">
          <Link
            href="/loginpage"
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
