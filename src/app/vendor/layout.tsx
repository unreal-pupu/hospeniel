"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import {
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  UtensilsCrossed,
  Clock,
  Settings,
  HelpCircle,
  ShieldCheck,
  Bell,
  MessageSquare,
} from "lucide-react";
import NotificationBell from "@/components/NotificationBell";

export default function VendorLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<string>("free_trial");
  const [vendorCategory, setVendorCategory] = useState<string | null>(null);

  // ✅ Check auth once, but let child pages handle redirects to prevent conflicts
  // CRITICAL: Use timeout to prevent infinite loading
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const checkAuth = async () => {
      try {
        // Add timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
          if (isMounted) {
            console.warn("⚠️ Auth check timeout - defaulting to authenticated state");
            setIsAuthenticated(true); // Default to true to allow layout to render
            setSubscriptionPlan("free_trial");
          }
        }, 5000); // 5 second timeout

        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        
        // Clear timeout if we got a response
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        if (isMounted) {
          if (error || !user) {
            setIsAuthenticated(false);
            // Don't redirect here - let the child page handle it to prevent loops
          } else {
            setIsAuthenticated(true);
            
            // ✅ CRITICAL: Check role from profiles.role - admins should go to admin dashboard
            // Use timeout for profile fetch too
            const profileTimeout = setTimeout(() => {
              if (isMounted) {
                console.warn("⚠️ Profile fetch timeout - using default subscription plan");
                setSubscriptionPlan("free_trial");
              }
            }, 3000);

            try {
              const { data: profile } = await supabase
                .from("profiles")
                .select("subscription_plan, role, category, approval_status")
                .eq("id", user.id)
                .single();
              
              clearTimeout(profileTimeout);
              
              // Redirect admins to admin dashboard (check role, not is_admin flag)
              if (profile && profile.role?.toLowerCase().trim() === "admin") {
                console.log("⚠️ Vendor Layout: User has admin role - redirecting to admin dashboard");
                if (isMounted) {
                  window.location.replace("/admin");
                }
                return;
              }

              if (profile && profile.role?.toLowerCase().trim() === "vendor" && profile.approval_status !== "approved") {
                console.log("⚠️ Vendor Layout: Vendor not approved - blocking access");
                await supabase.auth.signOut();
                localStorage.removeItem('hospineil-auth');
                if (isMounted) {
                  const approvalParam = profile.approval_status === "rejected" ? "rejected" : "pending";
                  window.location.replace(`/loginpage?approval=${approvalParam}`);
                }
                return;
              }
              
              if (isMounted) {
                setSubscriptionPlan(profile?.subscription_plan || "free_trial");
                setVendorCategory(profile?.category || null);
              }
            } catch (profileErr) {
              clearTimeout(profileTimeout);
              console.error("Profile fetch error:", profileErr);
              if (isMounted) {
                setSubscriptionPlan("free_trial");
              }
            }
          }
        }
      } catch (err) {
        console.error("Auth check error:", err);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (isMounted) {
          setIsAuthenticated(true); // Default to true to allow layout to render
          setSubscriptionPlan("free_trial");
        }
      }
    };

    checkAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (isMounted) {
        setIsAuthenticated(!!session);
      }
    });

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Clear localStorage session data
      localStorage.removeItem('hospineil-auth');
      
      // Clear Supabase auth storage (it might use different keys)
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('auth') || key.includes('sb-'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      console.log("✅ Vendor logged out successfully");
      
      // Redirect to login page with force parameter to ensure login form is shown
      window.location.href = "/loginpage?logout=true";
    } catch (err) {
      console.error("Logout error:", err);
      alert("An error occurred during logout. Please try again.");
    }
  };

  // Check if vendor is a cook or chef (limited menu/orders access)
  const isCookOrChef = vendorCategory === "chef" || vendorCategory === "home_cook";
  const canManageMenu = !isCookOrChef || subscriptionPlan === "professional";
  const canManageOrders = !isCookOrChef || subscriptionPlan === "professional";

  // Base links (conditionally show menu/orders based on category)
  const baseLinks = [
    { href: "/vendor/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
    ...(canManageMenu ? [{ href: "/vendor/menu", label: "Menu", icon: <UtensilsCrossed size={18} /> }] : []),
    ...(canManageOrders ? [{ href: "/vendor/orders", label: "Orders", icon: <Clock size={18} /> }] : []),
    { href: "/vendor/notifications", label: "Notifications", icon: <Bell size={18} /> },
  ];

  // Premium links (only for Professional plan vendors)
  // Also show Service Requests for chefs/home cooks (they don't need premium plan)
  const premiumLinks = subscriptionPlan === "professional"
    ? [{ href: "/vendor/service-requests", label: "Service Requests", icon: <MessageSquare size={18} /> }]
    : isCookOrChef
    ? [{ href: "/vendor/service-requests", label: "Service Requests", icon: <MessageSquare size={18} /> }]
    : [];

  // Other links (always visible)
  const otherLinks = [
    { href: "/vendor/subscription", label: "Subscription", icon: <ShieldCheck size={18} /> },
    { href: "/vendor/settings", label: "Settings", icon: <Settings size={18} /> },
    { href: "/vendor/help", label: "Help Center", icon: <HelpCircle size={18} /> },
    { href: "/vendor/privacy", label: "Privacy Policy", icon: <ShieldCheck size={18} /> },
  ];

  const links = [...baseLinks, ...premiumLinks, ...otherLinks];

  // Render immediately - don't wait for auth check
  // This prevents chunk loading issues and infinite loading states
  return (
    <div className="min-h-screen bg-hospineil-base-bg flex flex-col">
      {/* ✅ Top Navbar */}
      <header className="flex items-center justify-between bg-white shadow-sm border-b border-gray-200 px-4 py-3 lg:px-8 sticky top-0 z-30">
        <h1 className="text-2xl font-bold text-hospineil-primary font-logo">Hospineil</h1>
        <div className="flex items-center gap-4">
          {/* Only show NotificationBell if authenticated (prevents errors) */}
          {isAuthenticated === true && (
            <NotificationBell userType="vendor" notificationsPageUrl="/vendor/notifications" />
          )}
          <button
            className="lg:hidden text-gray-700 hover:bg-gray-100 p-2 rounded-lg transition-colors"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>
      </header>

      {/* ✅ Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex flex-1">
        {/* ✅ Sidebar */}
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
              <h2 className="text-xl font-bold text-white font-logo">Vendor Panel</h2>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg
                    transition-colors duration-200 font-button
                    ${
                      pathname === link.href
                        ? "bg-white/20 text-white font-semibold"
                        : "text-white/90 hover:bg-hospineil-accent hover:text-white"
                    }
                  `}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              ))}
            </nav>

            {/* Logout Button */}
            <div className="p-4 border-t border-hospineil-primary/20">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white/90 hover:bg-red-500/20 hover:text-white transition-colors duration-200 font-button"
              >
                <LogOut size={20} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </aside>

        {/* ✅ Main Content */}
        <main className="flex-1 p-4 lg:p-8 pt-6 lg:pt-10 transition-all duration-300 bg-hospineil-base-bg">
          {/* Always render children - don't block on auth check */}
          {children}
        </main>
      </div>
    </div>
  );
}
