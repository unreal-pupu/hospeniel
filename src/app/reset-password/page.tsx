"use client";

import { useState, useEffect } from "react";
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
import { validatePassword, getPasswordRequirements } from "@/lib/passwordValidation";
import { Lock, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const router = useRouter();

  // Check if user has a valid password reset session
  useEffect(() => {
    const checkResetSession = async () => {
      try {
        setCheckingSession(true);
        setSessionError("");

        // Check if there's a hash in the URL (from email link)
        const hash = window.location.hash;
        if (hash) {
          // Parse the hash to extract the access token
          const hashParams = new URLSearchParams(hash.substring(1));
          const accessToken = hashParams.get("access_token");
          const type = hashParams.get("type");

          if (type === "recovery" && accessToken) {
            // Set the session using the access token from the email link
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: hashParams.get("refresh_token") || "",
            });

            if (error) {
              console.error("Error setting session:", error);
              setSessionError("Invalid or expired reset link. Please request a new password reset.");
              setHasValidSession(false);
              return;
            }

            if (data.session) {
              setHasValidSession(true);
              // Clear the hash from URL for security
              window.history.replaceState(null, "", window.location.pathname);
            } else {
              setSessionError("Invalid or expired reset link. Please request a new password reset.");
              setHasValidSession(false);
            }
          } else {
            setSessionError("Invalid reset link. Please request a new password reset.");
            setHasValidSession(false);
          }
        } else {
          // Check if user already has a valid session (they might have clicked the link)
          const { data: { session }, error } = await supabase.auth.getSession();

          if (error) {
            console.error("Error checking session:", error);
            setSessionError("Unable to verify reset session. Please request a new password reset.");
            setHasValidSession(false);
            return;
          }

          if (session) {
            // Check if this is a recovery session (password reset)
            // In Supabase, recovery sessions are temporary and allow password updates
            setHasValidSession(true);
          } else {
            setSessionError("No active reset session found. Please request a new password reset link.");
            setHasValidSession(false);
          }
        }
      } catch (err: any) {
        console.error("Error checking reset session:", err);
        setSessionError("An error occurred while verifying your reset link. Please try again.");
        setHasValidSession(false);
      } finally {
        setCheckingSession(false);
      }
    };

    checkResetSession();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setMessageType("info");
    setPasswordErrors([]);

    // Validate password match
    if (password !== confirm) {
      setMessage("Passwords do not match.");
      setMessageType("error");
      return;
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setPasswordErrors(passwordValidation.errors);
      setMessage("Password does not meet security requirements. Please check the requirements below.");
      setMessageType("error");
      return;
    }

    // Verify session is still valid
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setMessage("Your reset session has expired. Please request a new password reset link.");
      setMessageType("error");
      setHasValidSession(false);
      return;
    }

    setLoading(true);

    try {
      // ✅ SECURITY: Supabase Auth automatically hashes the password using bcrypt
      // The password is never stored in plain text - it goes directly to auth.users.encrypted_password
      const { error } = await supabase.auth.updateUser({ 
        password: password.trim() 
      });

      if (error) {
        // Handle specific error cases
        if (error.message.includes("session") || error.message.includes("expired")) {
          setMessage("Your reset session has expired. Please request a new password reset link.");
          setMessageType("error");
          setHasValidSession(false);
        } else if (error.message.includes("rate limit") || error.message.includes("too many")) {
          setMessage("Too many requests. Please wait a few minutes before trying again.");
          setMessageType("error");
        } else {
          setMessage(error.message || "Failed to update password. Please try again.");
          setMessageType("error");
        }
      } else {
        // Success - password updated
        setMessage("Password updated successfully! Redirecting to login...");
        setMessageType("success");

        // Sign out to clear the recovery session
        await supabase.auth.signOut();

        // Redirect to login after a short delay
        setTimeout(() => {
          router.push("/loginpage?passwordReset=success");
        }, 2000);
      }
    } catch (err: any) {
      console.error("Error resetting password:", err);
      setMessage("An unexpected error occurred. Please try again.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking session
  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <Card className="w-full max-w-md shadow-lg rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-sm text-gray-600">Verifying reset link...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error if no valid session
  if (!hasValidSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <Card className="w-full max-w-md shadow-lg rounded-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              Invalid Reset Link
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-700">
                {sessionError || "This password reset link is invalid or has expired."}
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-600 text-center">
                Please request a new password reset link to continue.
              </p>

              <Button
                onClick={() => router.push("/forgot-password")}
                className="w-full"
              >
                Request New Reset Link
              </Button>
            </div>
          </CardContent>

          <CardFooter className="flex justify-center">
            <Link
              href="/loginpage"
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
      <Card className="w-full max-w-md shadow-lg rounded-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <Lock className="w-6 h-6 text-green-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            Reset Password
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Enter your new password below.
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setMessage("");
                  // Validate password on change
                  if (e.target.value.length > 0) {
                    const validation = validatePassword(e.target.value);
                    setPasswordErrors(validation.errors);
                  } else {
                    setPasswordErrors([]);
                  }
                }}
                required
                disabled={loading}
                className={passwordErrors.length > 0 ? "border-red-500" : ""}
              />
              {/* Password Requirements */}
              <p className="text-xs text-gray-500 mt-1">
                {getPasswordRequirements()}
              </p>
              {/* Password Errors */}
              {passwordErrors.length > 0 && (
                <ul className="text-xs text-red-500 list-disc list-inside mt-1">
                  {passwordErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm Password</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Re-enter new password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setMessage("");
                }}
                required
                disabled={loading}
                className={confirm && password !== confirm ? "border-red-500" : ""}
              />
              {confirm && password !== confirm && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={loading || passwordErrors.length > 0}
            >
              {loading ? "Updating Password..." : "Update Password"}
            </Button>
          </form>

          {/* Message */}
          {message && (
            <div
              className={`mt-4 p-3 rounded-lg text-sm flex items-start gap-2 ${
                messageType === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : messageType === "error"
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-blue-50 text-blue-700 border border-blue-200"
              }`}
            >
              {messageType === "success" ? (
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              )}
              <span>{message}</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-center">
          <Link
            href="/loginpage"
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
