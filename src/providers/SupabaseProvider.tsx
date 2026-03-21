"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

interface SupabaseContextValue {
  supabase: typeof supabase;
  session: Session | null;
  loading: boolean;
}

const SupabaseContext = createContext<SupabaseContextValue | null>(null);

export default function SupabaseProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const SESSION_INIT_MS = 12_000;
      try {
        const { data, error } = await Promise.race([
          supabase.auth.getSession(),
          new Promise<Awaited<ReturnType<typeof supabase.auth.getSession>>>((resolve) =>
            setTimeout(() => {
              console.warn("[SupabaseProvider] getSession exceeded timeout — continuing without session");
              resolve({ data: { session: null }, error: null });
            }, SESSION_INIT_MS)
          ),
        ]);
        if (error) console.error("Session fetch error:", error.message);
        setSession(data?.session ?? null);
      } catch (e) {
        console.error("[SupabaseProvider] getSession failed:", e);
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <SupabaseContext.Provider value={{ supabase, session, loading }}>
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
