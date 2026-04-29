"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { fetchProfileForLogin } from "@/lib/fetch-login-profile";
import { getRoleBasedRedirect } from "@/lib/roleRouting";
import {
  LOGIN_SESSION_WAIT_MAX_MS,
  POST_LOGIN_AUTH_USER_WAIT_MS,
  waitForPersistedSession,
  waitForVerifiedUserForProfileQuery,
} from "@/lib/auth-timeouts";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function finalizeGoogleSignIn() {
      let handled = false;
      const currentUrl = new URL(window.location.href);
      const redirectParam =
        currentUrl.searchParams.get("redirect") ??
        // Supabase/other OAuth flows sometimes use redirect_to instead.
        currentUrl.searchParams.get("redirect_to");
      const safeRedirectParam = redirectParam && redirectParam !== "/" ? redirectParam : null;

      try {
        const authCode = currentUrl.searchParams.get("code");

        if (authCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(authCode);
          if (error) {
            console.error("[auth callback] exchangeCodeForSession failed:", error.message);
          }
        }

        const session = await waitForPersistedSession(supabase, LOGIN_SESSION_WAIT_MAX_MS);
        const verifiedUser = await waitForVerifiedUserForProfileQuery(
          supabase,
          POST_LOGIN_AUTH_USER_WAIT_MS
        );
        const user = verifiedUser ?? session?.user ?? null;

        if (!user?.id) {
          throw new Error("Authenticated user not available after OAuth callback");
        }

        const { profile, error: profileError } = await fetchProfileForLogin(supabase, user.id, {
          logPrefix: "[auth callback]",
        });

        if (profileError) {
          throw new Error(profileError.message);
        }

        if (!profile) {
          throw new Error("User profile not available after OAuth callback");
        }

        const role = profile.role;

        if (role === "vendor" && profile.approval_status !== "approved") {
          await supabase.auth.signOut();
          if (isMounted) {
            const approvalParam = profile.approval_status === "rejected" ? "rejected" : "pending";
            handled = true;
            router.replace(`/loginpage?approval=${approvalParam}`);
          }
          return;
        }

        if (role === "rider" && profile.rider_approval_status !== "approved") {
          if (isMounted) {
            const approvalParam = profile.rider_approval_status === "rejected" ? "rejected" : "pending";
            handled = true;
            router.replace(`/loginpage?approval=${approvalParam}`);
          }
          return;
        }

        const redirectResult = getRoleBasedRedirect(role, safeRedirectParam);
        if (isMounted) {
          handled = true;
          router.replace(redirectResult.path);
        }
        return;
      } catch (error) {
        console.error("[auth callback] Failed to finalize OAuth session:", error);
      } finally {
        // Fallback only when callback finalization failed.
        if (isMounted && !handled) {
          const fallbackUrl = new URL("/loginpage", window.location.origin);
          if (safeRedirectParam) {
            fallbackUrl.searchParams.set("redirect", safeRedirectParam);
          }
          router.replace(`${fallbackUrl.pathname}${fallbackUrl.search}`);
        }
      }
    }

    finalizeGoogleSignIn();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <p className="text-lg text-gray-600">Completing sign-in...</p>
        <p className="mt-2 text-sm text-gray-400">Please wait while we finish your Google login.</p>
      </div>
    </div>
  );
}
