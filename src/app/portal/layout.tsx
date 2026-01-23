"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  LayoutDashboard,
  Package,
  Bell,
  Settings,
  HelpCircle,
  LogOut,
  Menu,
  X,
  Landmark,
} from "lucide-react";
import Image from "next/image";

interface RiderLayoutProps {
  children: React.ReactNode;
}

export default function RiderLayout({ children }: RiderLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accessVerified, setAccessVerified] = useState(false);
  const [riderProfile, setRiderProfile] = useState<{
    name: string;
    avatar_url: string | null;
  } | null>(null);
  const checkExecutedRef = useRef(false);
  const errorShownRef = useRef(false);

  const checkRiderAccess = useCallback(async () => {
    // Prevent multiple simultaneous checks
    if (accessVerified) {
      setLoading(false);
      return;
    }

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error("Error getting user:", userError);
        setLoading(false);
        router.replace("/loginpage?redirect=/portal");
        return;
      }

      if (!user) {
        console.log("No user found - redirecting to login");
        setLoading(false);
        router.replace("/loginpage?redirect=/portal");
        return;
      }

      // Check if user is a rider with approved status
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("name, role, rider_approval_status")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        setLoading(false);
        // Only show error if it's a real error, not a temporary issue
        if (profileError.code === "PGRST116") {
          // No rows returned - profile doesn't exist
          if (!errorShownRef.current) {
            errorShownRef.current = true;
            alert("Profile not found. Please contact support.");
          }
          router.replace("/loginpage?redirect=/portal");
          return;
        }
        // For other errors, show specific message only once
        if (!errorShownRef.current) {
          errorShownRef.current = true;
          const errorMessage = profileError.message || profileError.code || "Database error";
          console.error("Profile fetch error details:", { code: profileError.code, message: profileError.message, details: profileError.details });
          alert(`Failed to verify access: ${errorMessage}. Please try refreshing the page.`);
        }
        return; // Don't redirect on temporary errors - let user try again
      }

      if (!profile) {
        console.log("No profile found");
        setLoading(false);
        if (!errorShownRef.current) {
          errorShownRef.current = true;
          alert("Profile not found. Please contact support.");
        }
        router.replace("/loginpage?redirect=/portal");
        return;
      }

      if (profile.role !== "rider") {
        console.log("User is not a rider:", profile.role);
        setLoading(false);
        if (!errorShownRef.current) {
          errorShownRef.current = true;
          alert("Access denied. This portal is only for riders.");
        }
        router.replace("/");
        return;
      }

      if (profile.rider_approval_status !== "approved") {
        console.log("Rider not approved:", profile.rider_approval_status);
        setLoading(false);
        if (!errorShownRef.current) {
          errorShownRef.current = true;
          // Show specific message based on status
          if (profile.rider_approval_status === "pending") {
            alert("Your rider account is pending approval. Please wait for admin approval before accessing the portal.");
          } else if (profile.rider_approval_status === "rejected") {
            alert("Your rider account application has been rejected. Please contact support for more information.");
          } else {
            alert("Your rider account status is not verified. Please contact support.");
          }
        }
        router.replace("/");
        return;
      }

      // All checks passed - grant access
      console.log("✅ Rider access verified");
      
      // Optionally fetch avatar from user_settings (don't block access if it fails)
      let avatarUrl: string | null = null;
      try {
        const { data: settings } = await supabase
          .from("user_settings")
          .select("avatar_url")
          .eq("user_id", user.id)
          .maybeSingle();
        avatarUrl = settings?.avatar_url || null;
      } catch (avatarError) {
        console.log("Could not fetch avatar (non-critical):", avatarError);
        // Continue without avatar - don't block access
      }
      
      setRiderProfile({
        name: profile.name || "Rider",
        avatar_url: avatarUrl,
      });
      setAccessVerified(true);
    } catch (error) {
      console.error("Unexpected error checking rider access:", error);
      const errorMessage = error instanceof Error ? error.message : "Unexpected error";
      console.error("Error details:", error);
      setLoading(false);
      // Don't redirect on unexpected errors - might be temporary
      // Only show error once
      if (!errorShownRef.current) {
        errorShownRef.current = true;
        alert(`Failed to verify access: ${errorMessage}. Please try refreshing the page.`);
      }
    } finally {
      setLoading(false);
    }
  }, [accessVerified, router]);

  useEffect(() => {
    // Only run check once per mount
    if (!checkExecutedRef.current) {
      checkExecutedRef.current = true;
      checkRiderAccess();
    }
  }, [checkRiderAccess]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push("/");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const navigationItems = [
    { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
    { href: "/portal/tasks", label: "Tasks", icon: Package },
    { href: "/portal/notifications", label: "Notifications", icon: Bell },
    { href: "/portal/payment-details", label: "Payment Details", icon: Landmark },
    { href: "/portal/settings", label: "Settings", icon: Settings },
    { href: "/portal/support", label: "Support", icon: HelpCircle },
  ];

  // Show loading state while checking access or if access not verified
  if (loading || !accessVerified) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-hospineil-base-bg">
        <div className="text-center">
          <p className="text-gray-600 font-body">Loading rider portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hospineil-base-bg flex">
      {/* Left Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-hospineil-primary shadow-xl
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-6 border-b border-hospineil-primary/20">
            <h2 className="text-xl font-bold text-white font-logo">Rider Portal</h2>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/portal" && pathname?.startsWith(item.href));
              return (
                <button
                  key={item.href}
                  onClick={() => {
                    router.push(item.href);
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-colors duration-200
                    ${
                      isActive
                        ? "bg-white/20 text-white font-semibold"
                        : "text-white/90 hover:bg-hospineil-accent hover:text-white"
                    }
                  `}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Logout Button */}
          <div className="p-4 border-t border-hospineil-primary/20">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white/90 hover:bg-red-500/20 hover:text-white transition-colors duration-200"
            >
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
              >
                {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
              </button>

              {/* Greeting Section */}
              {riderProfile && (
                <div className="flex items-center gap-4 ml-auto">
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <h1 className="text-lg font-semibold text-gray-800">
                        Hello <span className="inline-block">👋</span>{" "}
                        <span className="text-hospineil-primary">{riderProfile.name}</span>
                      </h1>
                    </div>
                    <div className="relative">
                      <Image
                        src={riderProfile.avatar_url || "/default-avatar.png"}
                        alt={`${riderProfile.name}'s Avatar`}
                        width={48}
                        height={48}
                        className="rounded-full border-2 border-hospineil-primary/20 shadow-md object-cover"
                        priority
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}


