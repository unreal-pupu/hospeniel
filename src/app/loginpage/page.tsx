"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  getSessionWithTimeout,
  getUserWithTimeout,
  isLikelyMobileBrowser,
  LOGIN_AUTH_FETCH_TIMEOUT_MS,
  LOGIN_SESSION_WAIT_MAX_MS,
  POST_LOGIN_AUTH_USER_WAIT_MS,
  POST_SET_SESSION_SETTLE_MS,
  persistSessionAfterSignIn,
  waitForPersistedSession,
  waitForVerifiedUserForProfileQuery,
} from "@/lib/auth-timeouts";
import { fetchProfileForLogin } from "@/lib/fetch-login-profile";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false); // Track if login is in progress
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);

  // ✅ Check if user is already logged in - VERY STRICT validation to prevent false redirects
  // Only redirect if we're 100% certain there's a valid, authenticated session
  useEffect(() => {
    let isMounted = true;
    let redirectExecuted = false; // Prevent multiple redirects

    const verifySession = async () => {
      // Prevent infinite "Checking authentication..." if auth/network hangs on slow mobile networks
      const verificationTimeoutId = window.setTimeout(() => {
        if (isMounted) {
          console.warn("[login] Session verification timed out — showing login form");
          setCheckingSession(false);
        }
      }, 75_000);

      try {
        console.log("🔵 Login page: Starting session check...");
        
        // Small delay to ensure Supabase client is fully initialized
        await new Promise(resolve => setTimeout(resolve, 150));

        if (!isMounted) return;

        // ✅ STEP 0: Check if user explicitly wants to login (e.g., from logout)
        // Check URL parameters for force login
        const urlParams = new URLSearchParams(window.location.search);
        const forceLogin = urlParams.get('force') === 'true' || urlParams.get('logout') === 'true';
        const approvalParam = urlParams.get('approval');
        if (approvalParam === "pending") {
          setApprovalMessage("Your account is awaiting admin approval.");
        } else if (approvalParam === "rejected") {
          setApprovalMessage("Your account application has been rejected. Please contact support.");
        }
        // Store redirect parameter if present (used in redirect logic below)
        
        if (forceLogin) {
          console.log("🔵 Force login detected - clearing any existing session");
          await supabase.auth.signOut();
          // Clear from localStorage as well
          localStorage.removeItem('hospineil-auth');
          if (isMounted) {
            setCheckingSession(false);
          }
          return;
        }

        // Don't check session if user is actively logging in (prevents conflicts)
        if (isLoggingIn) {
          console.log("🔵 Login in progress - skipping session check");
          if (isMounted) {
            setCheckingSession(false);
          }
          return;
        }

        // ✅ STEP 1: Check for ACTIVE session (not just user)
        console.log("🔵 Checking for existing session...");
        const { data: sessionData, error: sessionError } = await getSessionWithTimeout(
          supabase,
          LOGIN_AUTH_FETCH_TIMEOUT_MS
        );
        
        console.log("🔵 Session check result:", {
          hasError: !!sessionError,
          error: sessionError?.message,
          hasSession: !!sessionData?.session,
          hasAccessToken: !!sessionData?.session?.access_token,
          expiresAt: sessionData?.session?.expires_at
        });
        
        // If no session or session error, show login form
        if (sessionError || !sessionData?.session) {
          console.log("✅ No valid session found - showing login form");
          if (isMounted) {
            setCheckingSession(false);
          }
          return;
        }

        // ✅ STEP 2: Verify session is not expired and has required properties
        const session = sessionData.session;
        console.log("🔵 Validating session properties...");
        
        // Check if session has access_token (required for valid session)
        if (!session?.access_token) {
          console.log("❌ Invalid session - no access token");
          await supabase.auth.signOut();
          localStorage.removeItem('hospineil-auth');
          if (isMounted) {
            setCheckingSession(false);
          }
          return;
        }

        // Check if session is expired (with buffer time)
        const now = Date.now() / 1000;
        if (session.expires_at) {
          const expiresAt = session.expires_at;
          const timeUntilExpiry = expiresAt - now;
          
          console.log("🔵 Session expiry check:", {
            expiresAt,
            now,
            timeUntilExpiry,
            isExpired: expiresAt < now
          });
          
          // If expired or expiring within 5 minutes, treat as expired
          if (expiresAt < now || timeUntilExpiry < 300) {
            console.log("❌ Session expired or expiring soon - clearing session");
            await supabase.auth.signOut();
            localStorage.removeItem('hospineil-auth');
            if (isMounted) {
              setCheckingSession(false);
            }
            return;
          }
        }

        // Verify session has a user
        if (!session?.user?.id) {
          console.log("❌ Session has no user - invalid");
          await supabase.auth.signOut();
          localStorage.removeItem('hospineil-auth');
          if (isMounted) {
            setCheckingSession(false);
          }
          return;
        }

        if (!isMounted) return;

        // ✅ STEP 3: CRITICAL - Validate token server-side with getUser()
        // This is the most important check - it validates the token with Supabase
        console.log("🔵 Validating session token with server (getUser)...");
        const { data: userData, error: userError } = await getUserWithTimeout(
          supabase,
          LOGIN_AUTH_FETCH_TIMEOUT_MS
        );
        
        console.log("🔵 getUser() result:", {
          hasError: !!userError,
          error: userError?.message,
          hasUser: !!userData?.user,
          userId: userData?.user?.id
        });
        
        // If getUser() fails OR returns no user, the session is INVALID
        // This means the token is expired, invalid, or the user doesn't exist
        if (userError) {
          console.log("❌ Session validation failed - getUser() error:", userError.message);
          // Clear invalid session
          await supabase.auth.signOut();
          localStorage.removeItem('hospineil-auth');
          if (isMounted) {
            setCheckingSession(false);
          }
          return;
        }

        if (!userData?.user) {
          console.log("❌ Session validation failed - No user data returned from server");
          // Clear invalid session
          await supabase.auth.signOut();
          localStorage.removeItem('hospineil-auth');
          if (isMounted) {
            setCheckingSession(false);
          }
          return;
        }

        // ✅ STEP 4: Verify user IDs match (session user = current user)
        if (session.user.id !== userData.user.id) {
          console.log("❌ Session user ID mismatch - session is stale");
          console.log("Session user ID:", session.user.id, "Server user ID:", userData.user.id);
          // Mismatch - session is stale, clear and show login form
          await supabase.auth.signOut();
          localStorage.removeItem('hospineil-auth');
          if (isMounted) {
            setCheckingSession(false);
          }
          return;
        }

        // ✅ STEP 5: Additional validation - verify user email exists
        if (!userData.user.email) {
          console.log("❌ User has no email - invalid user");
          await supabase.auth.signOut();
          localStorage.removeItem('hospineil-auth');
          if (isMounted) {
            setCheckingSession(false);
          }
          return;
        }

        console.log("✅ Session validation passed - user authenticated:", userData.user.email);

        if (!isMounted || redirectExecuted) return;

        // ✅ STEP 6: Fetch profile (retries + ensure_my_profile if row missing — mobile/RLS/storage)
        console.log("🔵 Fetching user profile...");
        const { profile, error: profileError } = await fetchProfileForLogin(
          supabase,
          userData.user.id,
          { logPrefix: "[login session]" }
        );

        console.log("🔵 Profile fetch result:", {
          hasError: !!profileError,
          error: profileError?.message,
          hasProfile: !!profile,
          role: profile?.role,
          is_admin: profile?.is_admin
        });

        // If profile fetch fails or no profile, show login form (don't redirect)
        if (profileError) {
          console.error("❌ Profile fetch error:", profileError.message);
          // Don't clear session here - profile might just not exist yet
          // But don't redirect either - user needs to complete profile
          if (isMounted) {
            setCheckingSession(false);
          }
          return;
        }

        if (!profile) {
          console.log("❌ No profile found for user - showing login form");
          if (isMounted) {
            setCheckingSession(false);
          }
          return;
        }

        if (!isMounted || redirectExecuted) return;

        // ✅ STEP 7: Read role ONLY from profiles.role column
        const role = profile.role;
        console.log("🔵 User profile - role from profiles.role:", role);
        
        // ✅ STEP 7.5: Check rider approval status before redirecting
        if (role === "rider") {
          const approvalStatus = profile.rider_approval_status;
          console.log("🔵 Rider approval status:", approvalStatus);
          
          if (approvalStatus !== "approved") {
            console.log("❌ Rider not approved - blocking access");
            if (isMounted) {
              setCheckingSession(false);
            }
            // Show appropriate message based on status
            if (approvalStatus === "pending") {
              alert("Your rider account is pending approval. Please wait for admin approval before accessing the portal.");
            } else if (approvalStatus === "rejected") {
              alert("Your rider account application has been rejected. Please contact support for more information.");
            } else {
              alert("Your rider account status is not verified. Please contact support.");
            }
            return; // Don't redirect - show login form
          }
          console.log("✅ Rider is approved - allowing access to portal");
        }

      if (role === "vendor") {
        const approvalStatus = profile.approval_status;
        console.log("🔵 Vendor approval status:", approvalStatus);

        if (approvalStatus !== "approved") {
          console.log("❌ Vendor not approved - blocking access");
          await supabase.auth.signOut();
          localStorage.removeItem('hospineil-auth');
          if (isMounted) {
            setApprovalMessage("Your account is awaiting admin approval.");
            setCheckingSession(false);
          }
          return;
        }
        console.log("✅ Vendor is approved - allowing access");
      }
        
        // ✅ STEP 8: Determine redirect path based on role (using centralized logic)
        // Check sessionStorage for returnUrl first (set when user tries to checkout)
        let redirectPathFromStorage: string | null = null;
        if (typeof window !== "undefined") {
          redirectPathFromStorage = sessionStorage.getItem("returnUrl");
          if (redirectPathFromStorage) {
            sessionStorage.removeItem("returnUrl");
          }
        }
        
        // Check for redirect parameter in URL (reuse urlParams from line 46)
        const redirectParam = urlParams.get('redirect') || redirectPathFromStorage;
        
        // Use centralized role-based routing
        const { getRoleBasedRedirect } = await import("@/lib/roleRouting");
        const redirectResult = getRoleBasedRedirect(role, redirectParam);
        const redirectPath = redirectResult.path;
        
        console.log("✅", redirectResult.reason);

        // ✅ STEP 9: Final check - all validations passed, safe to redirect
        // BUT - only redirect if we're absolutely sure
        if (redirectExecuted) {
          console.log("⚠️ Redirect already executed, skipping");
          return;
        }
        
        redirectExecuted = true;
        console.log("✅✅✅ ALL VALIDATIONS PASSED - Redirecting to:", redirectPath);
        console.log("✅ Session is valid, user is authenticated, profile exists");

        // Small delay to ensure everything is set
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!isMounted) return;

        // Redirect based on user type
        router.replace(redirectPath);
      } catch (err) {
        console.error("❌ Session check error:", err);
        // On any error, show login form (don't redirect)
        // Clear any potentially corrupted session
        try {
          await supabase.auth.signOut();
          localStorage.removeItem('hospineil-auth');
        } catch (clearError) {
          console.error("Error clearing session:", clearError);
        }
        if (isMounted) {
          setCheckingSession(false);
        }
      } finally {
        window.clearTimeout(verificationTimeoutId);
      }
    };

    verifySession();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once on mount


  // ✅ Handle Login - with comprehensive logging and error handling
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("🔵 Login attempt started");
    setLoading(true);
    setIsLoggingIn(true); // Prevent session check from interfering

    try {
      // Step 1: Sign in with email and password
      console.log("🔵 Calling signInWithPassword...");
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log("🔵 signInWithPassword response:", { 
        hasError: !!error, 
        error: error?.message,
        hasUser: !!authData?.user,
        hasSession: !!authData?.session,
        userId: authData?.user?.id 
      });

      if (error) {
        console.error("❌ Login error:", error.message);
        setLoading(false);
        setIsLoggingIn(false);
        alert(error.message);
        return;
      }

      // Step 2: Verify user exists
      const user = authData?.user;

      if (!user) {
        console.error("❌ No user returned from signIn");
        setLoading(false);
        setIsLoggingIn(false);
        alert("Unable to retrieve user information.");
        return;
      }

      // Step 2b: Persist tokens to storage immediately so JWT is attached before profile queries (mobile).
      const signInSession = authData?.session ?? null;
      let sessionReady = signInSession?.access_token ? signInSession : null;

      await persistSessionAfterSignIn(supabase, signInSession);

      if (!sessionReady?.access_token) {
        console.log("🔵 No session in signIn response — waiting for persisted session...");
        sessionReady = await waitForPersistedSession(supabase, LOGIN_SESSION_WAIT_MAX_MS);
      }

      if (!sessionReady?.access_token) {
        console.error("❌ Session not available after sign-in");
        setLoading(false);
        setIsLoggingIn(false);
        alert("Session not created. Please try again.");
        return;
      }
      console.log("✅ Session ready for API calls");

      // Poll getUser() until server-verified user (JWT valid for RLS). Mobile: short settle after setSession.
      const settleMs = isLikelyMobileBrowser() ? POST_SET_SESSION_SETTLE_MS : 0;
      const verifiedUser = await waitForVerifiedUserForProfileQuery(
        supabase,
        POST_LOGIN_AUTH_USER_WAIT_MS,
        400,
        settleMs
      );
      const fallbackUser = sessionReady.user ?? user;
      const canonicalUser = verifiedUser ?? fallbackUser ?? null;

      if (!canonicalUser?.id) {
        console.error("❌ No user from getSession/getUser or signIn response");
        setLoading(false);
        setIsLoggingIn(false);
        alert("Unable to verify your session. Please check your connection and try again.");
        return;
      }

      if (!verifiedUser && fallbackUser) {
        console.warn("[login] Using signIn/session user fallback after getUser poll (slow network OK)");
      }

      console.log("🔵 User authenticated:", canonicalUser.id, canonicalUser.email);

      // Step 3: Fetch profile — retries + ensure_my_profile if row missing
      console.log("🔵 Fetching user profile...");
      const { profile, error: profileError } = await fetchProfileForLogin(supabase, canonicalUser.id, {
        logPrefix: "[login]",
      });

      console.log("🔵 Profile fetch response:", { 
        hasError: !!profileError,
        error: profileError?.message,
        hasProfile: !!profile,
        role: profile?.role,
        is_admin: profile?.is_admin
      });

      if (profileError) {
        console.error("❌ Profile fetch error:", profileError.message, profileError);
        setLoading(false);
        setIsLoggingIn(false);
        alert(`Error loading profile: ${profileError.message}. Please try again.`);
        return;
      }

      if (!profile) {
        console.error("❌ No profile found for user");
        setLoading(false);
        setIsLoggingIn(false);
        alert("User profile not found. Please contact support.");
        return;
      }

      // ✅ CRITICAL: Read role ONLY from profiles.role column
      const role = profile.role;
      console.log("✅ Profile loaded, role from profiles.role:", role);

      // ✅ CRITICAL: Check rider approval status before redirecting
      if (role === "rider") {
        const approvalStatus = profile.rider_approval_status;
        console.log("🔵 Rider approval status:", approvalStatus);
        
        if (approvalStatus !== "approved") {
          console.log("❌ Rider not approved - blocking login");
          setLoading(false);
          setIsLoggingIn(false);
          
          // Show appropriate message based on status
          if (approvalStatus === "pending") {
            alert("Your rider account is pending approval. Please wait for admin approval before accessing the portal.");
          } else if (approvalStatus === "rejected") {
            alert("Your rider account application has been rejected. Please contact support for more information.");
          } else {
            alert("Your rider account status is not verified. Please contact support.");
          }
          return; // Don't redirect - stay on login page
        }
        console.log("✅ Rider is approved - allowing login");
      }

      if (role === "vendor") {
        const approvalStatus = profile.approval_status;
        console.log("🔵 Vendor approval status:", approvalStatus);

        if (approvalStatus !== "approved") {
          console.log("❌ Vendor not approved - blocking login");
          await supabase.auth.signOut();
          localStorage.removeItem('hospineil-auth');
          setLoading(false);
          setIsLoggingIn(false);
          setApprovalMessage("Your account is awaiting admin approval.");
          return; // Don't redirect - stay on login page
        }
        console.log("✅ Vendor is approved - allowing login");
      }

      // Step 4: Determine redirect path based on role (using centralized logic)
      // Check sessionStorage for returnUrl first (set when user tries to checkout)
      let redirectPathFromStorage: string | null = null;
      if (typeof window !== "undefined") {
        redirectPathFromStorage = sessionStorage.getItem("returnUrl");
        if (redirectPathFromStorage) {
          sessionStorage.removeItem("returnUrl");
        }
      }
      
      // Check for redirect parameter in URL (e.g., from protected pages)
      const urlParams = new URLSearchParams(window.location.search);
      const redirectParam = urlParams.get('redirect') || redirectPathFromStorage;
      
      // Use centralized role-based routing
      const { getRoleBasedRedirect } = await import("@/lib/roleRouting");
      const redirectResult = getRoleBasedRedirect(role, redirectParam);
      const redirectPath = redirectResult.path;
      
      console.log("✅", redirectResult.reason);

      console.log("✅ Login successful! Redirecting to:", redirectPath);

      // Step 5: Session was already verified + profile loaded; do not use short getSession
      // races here — on mobile they often false-fail while the real session is still loading.
      console.log("✅ Session and profile ready for redirect");

      // Set flag to prevent session check from interfering
      setIsLoggingIn(false);

      // Use window.location.href for immediate, guaranteed redirect
      // This is the most reliable method for post-login redirects
      console.log("🔵 Executing redirect to:", redirectPath);
      
      // For vendor or admin login, ensure we do a full page reload to clear any cached state
      if (role === "vendor" || role === "admin") {
        console.log(`🔵 ${role === "admin" ? "Admin" : "Vendor"} login - doing full page reload`);
        window.location.replace(redirectPath);
      } else {
        window.location.href = redirectPath;
      }

    } catch (err) {
      console.error("❌ Unexpected login error:", err);
      setLoading(false);
      setIsLoggingIn(false);
      const errorMessage = err instanceof Error ? err.message : "Please try again.";
      alert(`An unexpected error occurred: ${errorMessage}`);
    }
  };

  // ✅ Wait for session check before showing the form
  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-600 text-lg">Checking authentication...</p>
          <p className="text-gray-400 text-sm mt-2">Please wait...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-hospineil-base-bg px-4">
      <Card className="w-full max-w-md shadow-md rounded-2xl">
        <CardHeader>
          <CardTitle className="text-center">
            <h2 className="text-2xl font-bold font-logo tracking-tight">
              Hospe<span className="italic text-hospineil-accent">niel</span>
            </h2>
            <p className="text-hospineil-primary text-sm font-body mt-2">Welcome back</p>
          </CardTitle>
        </CardHeader>

        <CardContent>
          {approvalMessage && (
            <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              {approvalMessage}
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-body">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="pl-10 bg-hospineil-light-bg border-gray-300 focus:ring-hospineil-primary focus:border-hospineil-primary"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="font-body">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="pl-10 pr-10 bg-hospineil-light-bg border-gray-300 focus:ring-hospineil-primary focus:border-hospineil-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-hospineil-primary transition-colors duration-300"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="text-right">
              <Link
                href="/forgot-password"
                className="text-sm text-hospineil-primary hover:text-hospineil-accent transition-colors duration-300"
              >
                Forgot password?
              </Link>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-hospineil-primary text-hospineil-light-bg hover:bg-hospineil-primary/90 transition-all duration-300 hover:scale-105 hover:shadow-lg font-button" 
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Logging in...
                </span>
              ) : (
                "Login"
              )}
            </Button>
          </form>

          <div className="flex items-center space-x-2 my-4">
            <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700"></div>
            <span className="text-sm text-gray-500 dark:text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700"></div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
              });
              if (error) alert(error.message);
            }}
          >
            Continue with Google
          </Button>
        </CardContent>

        <CardFooter className="flex justify-center">
          <p className="text-sm text-gray-600 font-body">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-hospineil-primary hover:text-hospineil-accent transition-colors duration-300">
              Register
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
