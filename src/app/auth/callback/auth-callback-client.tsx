"use client";

/**
 * SINGLE SOURCE of the strings "Completing sign-in..." / "finish your Google login".
 * This component mounts ONLY after the Server Component verified a non-empty OAuth ?code= (PKCE).
 * Email/password login must never reach this file.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { fetchProfileForLogin } from "@/lib/fetch-login-profile";
import { getRoleBasedRedirect, sanitizeUserPostLoginRedirect } from "@/lib/roleRouting";
import {
  LOGIN_SESSION_WAIT_MAX_MS,
  POST_LOGIN_AUTH_USER_WAIT_MS,
  waitForPersistedSession,
  waitForVerifiedUserForProfileQuery,
} from "@/lib/auth-timeouts";
import {
  AUTH_METHOD_STORAGE_KEY,
  PASSWORD_LOGIN_CALLBACK_GUARD_MS,
  clearPasswordLoginCompletionMarker,
  getMsSincePasswordLoginCompletion,
} from "@/lib/password-login-navigation";

const OAUTH_PROGRESS_KEY = "oauth-in-progress";

function stripPkceParamsFromBrowserUrl(): void {
  if (typeof window === "undefined") return;
  const u = new URL(window.location.href);
  u.searchParams.delete("code");
  u.searchParams.delete("state");
  const qs = u.searchParams.toString();
  const next = `${u.pathname}${qs ? `?${qs}` : ""}${u.hash}`;
  window.history.replaceState(window.history.state, "", next);
}

export function AuthCallbackClient({
  initialCode,
  redirectParamRaw,
}: {
  initialCode: string;
  redirectParamRaw: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    const authMethod = sessionStorage.getItem(AUTH_METHOD_STORAGE_KEY);
    if (authMethod === "email_password") {
      console.error(
        "[auth-callback][BLOCKER] OAuth callback ran while session was still marked email_password — password login must not use OAuth routes.",
        new Error().stack,
        {
          href: typeof window !== "undefined" ? window.location.href : "",
          referrer: typeof document !== "undefined" ? document.referrer : "",
        }
      );
    }

    console.log("[auth-callback] client mounted (PKCE code present on server)", {
      codeLength: initialCode.length,
      authMethodTracked: authMethod,
      referrer: typeof document !== "undefined" ? document.referrer : "",
      href: typeof window !== "undefined" ? window.location.href : "",
      sessionStorage_oauth_in_progress: sessionStorage.getItem(OAUTH_PROGRESS_KEY),
      sessionStorage_oauth_redirect: sessionStorage.getItem("oauth-redirect"),
    });

    let isMounted = true;

    async function finalizeGoogleSignIn() {
      let handled = false;
      const safeRedirectParam = sanitizeUserPostLoginRedirect(
        redirectParamRaw && redirectParamRaw !== "/" ? redirectParamRaw : null
      );

      sessionStorage.removeItem(OAUTH_PROGRESS_KEY);
      sessionStorage.removeItem("oauth-redirect");

      try {
        const msSincePw = getMsSincePasswordLoginCompletion();
        const recentPasswordCompletion =
          msSincePw != null && msSincePw >= 0 && msSincePw <= PASSWORD_LOGIN_CALLBACK_GUARD_MS;

        const { data: existingBeforeExchange } = await supabase.auth.getSession();
        const hasExistingSession = Boolean(
          existingBeforeExchange?.session?.access_token && existingBeforeExchange?.session?.user?.id
        );

        let skipPkceExchange = false;
        if (recentPasswordCompletion && hasExistingSession) {
          skipPkceExchange = true;
          console.warn(
            "[auth-callback] Skipping exchangeCodeForSession — email/password login just established a session; stray OAuth route navigation.",
            {
              msSincePw,
              stack: new Error().stack,
              userId: existingBeforeExchange?.session?.user?.id,
            }
          );
          clearPasswordLoginCompletionMarker();
          stripPkceParamsFromBrowserUrl();
        }

        if (!skipPkceExchange) {
          const { error } = await supabase.auth.exchangeCodeForSession(initialCode);
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
      } catch (error) {
        console.error("[auth callback] Failed to finalize OAuth session:", error);
      } finally {
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
  }, [router, initialCode, redirectParamRaw]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <p className="text-lg text-gray-600">Completing sign-in...</p>
        <p className="mt-2 text-sm text-gray-400">Please wait while we finish your Google login.</p>
      </div>
    </div>
  );
}
