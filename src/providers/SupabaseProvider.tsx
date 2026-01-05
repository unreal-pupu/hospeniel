"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const SupabaseContext = createContext(null);

export default function SupabaseProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) console.error("Session fetch error:", error.message);
      setSession(data?.session ?? null);
      setLoading(false);
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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
