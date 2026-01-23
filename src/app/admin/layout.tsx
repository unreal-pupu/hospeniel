"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  LayoutDashboard,
  Users,
  Store,
  ShoppingBag,
  CreditCard,
  MessageSquare,
  BarChart3,
  Bell,
  LogOut,
  Menu,
  X,
  Shield,
  Star,
  HelpCircle,
  Settings,
  Truck,
  HandCoins,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Check admin access with optional secret key verification
  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push("/loginpage?redirect=/admin");
          return;
        }

        // ✅ CRITICAL: Check role from profiles.role column (not is_admin flag)
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("role, name")
          .eq("id", user.id)
          .single();

        if (error || !profile) {
          console.error("Error checking admin status:", error);
          setLoading(false);
          return;
        }

        // ✅ SECURITY: Verify admin role from profiles.role
        const role = profile.role?.toLowerCase().trim();
        if (role !== "admin") {
          console.warn("⚠️ SECURITY: Non-admin user attempted to access admin dashboard. Role:", profile.role);
          setLoading(false);
          return; // Will show access denied message
        }

        // ✅ OPTIONAL: Additional secret key verification (server-side check)
        // Check if secret key verification is enabled
        const storedKey = typeof window !== "undefined" 
          ? sessionStorage.getItem("admin_secret_key")
          : null;
        
        const urlKey = typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("admin_key")
          : null;

        // If no stored key, check if secret key is required
        if (!storedKey && !urlKey) {
          try {
            // Check if secret key is configured by calling the API
            const response = await fetch("/api/admin/verify-secret", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ secretKey: "" }), // Empty to check if key is required
            });

            const result = await response.json();
            
            // If secret key is configured and required
            if (result.requiresKey) {
              const userKey = prompt("Admin Secret Key Required:");
              if (!userKey) {
                alert("Secret key is required. Access denied.");
                router.push("/");
                setLoading(false);
                return;
              }

              // Verify the provided key
              const verifyResponse = await fetch("/api/admin/verify-secret", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ secretKey: userKey }),
              });

              const verifyResult = await verifyResponse.json();
              
              if (!verifyResult.valid) {
                alert("Invalid admin secret key. Access denied.");
                router.push("/");
                setLoading(false);
                return;
              }

              // Store in sessionStorage for this session
              if (typeof window !== "undefined") {
                sessionStorage.setItem("admin_secret_key", userKey);
              }
            }
            // If no secret key is configured, proceed without verification
          } catch (error) {
            console.error("Error checking secret key requirement:", error);
            // If verification fails, allow access (graceful degradation)
          }
        } else if (urlKey) {
          // If key provided in URL, verify it
          try {
            const response = await fetch("/api/admin/verify-secret", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ secretKey: urlKey }),
            });

            const result = await response.json();
            
            if (!result.valid) {
              alert("Invalid admin secret key. Access denied.");
              router.push("/");
              setLoading(false);
              return;
            }

            // Store in sessionStorage for this session
            if (typeof window !== "undefined") {
              sessionStorage.setItem("admin_secret_key", urlKey);
            }
          } catch (error) {
            console.error("Error verifying secret key:", error);
          }
        }

        setIsAdmin(true);
        setAdminName(profile.name || "Admin");
      } catch (error) {
        console.error("Error in admin check:", error);
      } finally {
        setLoading(false);
      }
    };

    checkAdminAccess();
  }, [router]);

  // Fetch unread notifications count
  useEffect(() => {
    if (!isAdmin) return;

    const fetchNotifications = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("read", false)
        .eq("vendor_id", user.id);

      setUnreadNotifications(count || 0);
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [isAdmin]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const navItems = [
    { href: "/admin", label: "Dashboard Home", icon: LayoutDashboard },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/vendors", label: "Vendors", icon: Store },
    { href: "/admin/riders", label: "Riders", icon: Users },
    { href: "/admin/delivery-reports", label: "Delivery Reports", icon: Truck },
    { href: "/admin/rider-payouts", label: "Rider Payouts", icon: HandCoins },
    { href: "/admin/delivery-commission", label: "Delivery Commission", icon: Truck },
    { href: "/admin/vat-collected", label: "VAT Collected", icon: BarChart3 },
    { href: "/admin/featured-vendors", label: "Featured Vendors", icon: Star },
    { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
    { href: "/admin/payments", label: "Payments", icon: CreditCard },
    { href: "/admin/service-requests", label: "Service Requests", icon: MessageSquare },
    { href: "/admin/support", label: "Support Messages", icon: HelpCircle },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/admin/notifications", label: "Notifications", icon: Bell },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-hospineil-base-bg">
        <div className="text-center">
          <Shield className="h-12 w-12 text-hospineil-primary mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600 font-body">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-hospineil-base-bg">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="bg-hospineil-light-bg rounded-2xl shadow-md p-8 border-2 border-red-200">
            <Shield className="h-16 w-16 text-red-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2 font-header">Access Denied</h1>
            <p className="text-gray-600 mb-6 font-body">
              You do not have permission to access the admin dashboard. 
              Admin privileges are required.
            </p>
            <Button
              onClick={() => router.push("/")}
              className="bg-hospineil-primary text-white hover:bg-hospineil-primary/90 hover:scale-105 transition-all font-button rounded-lg"
            >
              Return to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hospineil-base-bg flex flex-col">
      {/* Top Bar */}
      <header className="bg-white shadow-sm border-b border-gray-200 fixed top-0 left-0 right-0 z-40">
        <div className="flex items-center justify-between px-4 md:px-6 h-16">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <h1 className="text-xl font-bold text-hospineil-primary font-logo">Admin Dashboard</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden md:block font-body">
              {adminName}
            </span>
            <Link href="/admin/notifications" className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell className="h-5 w-5 text-gray-600 hover:text-hospineil-primary" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-hospineil-accent text-white rounded-full w-5 h-5 text-xs flex items-center justify-center font-button">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2 border-gray-300 text-gray-700 hover:bg-gray-100 hover:text-gray-800 font-button"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex pt-16">
        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-50
            w-64 bg-hospineil-primary shadow-xl
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            pt-16 lg:pt-0
          `}
        >
          <div className="flex flex-col h-full">
            {/* Sidebar Header */}
            <div className="p-6 border-b border-hospineil-primary/20 lg:hidden">
              <h2 className="text-xl font-bold text-white font-logo">Admin Panel</h2>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || 
                  (item.href !== "/admin" && pathname?.startsWith(item.href));
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-lg
                      transition-colors duration-200 font-button
                      ${
                        isActive
                          ? "bg-white/20 text-white font-semibold"
                          : "text-white/90 hover:bg-hospineil-accent hover:text-white"
                      }
                    `}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
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

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-8 pt-6 lg:pt-10 transition-all duration-300 bg-hospineil-base-bg">
          {children}
        </main>
      </div>
    </div>
  );
}

