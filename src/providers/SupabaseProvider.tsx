"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

interface SupabaseContextValue {
  supabase: typeof supabase;
  session: Session | null;
  user: Session["user"] | null;
  loading: boolean;
  initialized: boolean;
}

const SupabaseContext = createContext<SupabaseContextValue | null>(null);

export default function SupabaseProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const initialStateResolvedRef = { current: false };
    const fallbackTimeoutRef = { current: 0 as number | undefined };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, nextSession: Session | null) => {
      if (!isMounted) return;

      setSession(nextSession);

      if (!initialStateResolvedRef.current || event === "INITIAL_SESSION") {
        initialStateResolvedRef.current = true;
        setInitialized(true);
        setLoading(false);
      }
    });

    const hydrateInitialSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error("[SupabaseProvider] initial getSession failed:", error.message);
        }

        if (!isMounted || initialStateResolvedRef.current) return;

        initialStateResolvedRef.current = true;
        setSession(data.session ?? null);
        setInitialized(true);
        setLoading(false);
      } catch (error) {
        console.error("[SupabaseProvider] getSession failed:", error);

        if (!isMounted || initialStateResolvedRef.current) return;

        initialStateResolvedRef.current = true;
        setSession(null);
        setInitialized(true);
        setLoading(false);
      }
    };

    hydrateInitialSession();

    fallbackTimeoutRef.current = window.setTimeout(() => {
      if (!isMounted || initialStateResolvedRef.current) return;

      console.warn("[SupabaseProvider] auth initialization timed out; continuing with current session state");
      initialStateResolvedRef.current = true;
      setInitialized(true);
      setLoading(false);
    }, 15_000);

    return () => {
      isMounted = false;
      if (fallbackTimeoutRef.current) {
        window.clearTimeout(fallbackTimeoutRef.current);
      }
      subscription.unsubscribe();
    };
  }, []);

  // Do NOT redirect to OAuth callback routes from here. Google uses redirectTo=/auth/oauth/callback
  // and returns with ?code=… on that URL directly. Forcing callback when session appears while
  // oauth-in-progress was set (e.g. user clicked Google then logged in with email/password) sent
  // non-OAuth sessions to the OAuth UI without code/state.

  const value = useMemo<SupabaseContextValue>(
    () => ({
      supabase,
      session,
      user: session?.user ?? null,
      loading,
      initialized,
    }),
    [initialized, loading, session]
  );

  // Always render children. A full-screen "initializing" gate caused a visible flash on every
  // load (including the public homepage). Consumers use `initialized` / `loading` (Navbar,
  // login, admin/portal/vendor layouts) to avoid acting on session until hydration is done.
  return (
    <SupabaseContext.Provider value={value}>
      {children}
    </SupabaseContext.Provider>
  );
}

export const useSupabase = () => useContext(SupabaseContext);







// "use client";

// import { createBrowserClient } from "@supabase/ssr";
// import { SessionContextProvider } from "@supabase/auth-helpers-react";
// import { useState } from "react";

// export default function SupabaseProvider({ children }: { children: React.ReactNode }) {
//   const [supabase] = useState(() =>
//     createBrowserClient(
//       process.env.NEXT_PUBLIC_SUPABASE_URL!,
//       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
//     )
//   );

//   return (
//     <SessionContextProvider supabaseClient={supabase}>
//       {children}
//     </SessionContextProvider>
//   );
// }
