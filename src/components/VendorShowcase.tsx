"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { MapPin } from "lucide-react";

interface Vendor {
  id: string;
  name: string;
  image: string | null;
  description: string | null;
  status: string;
  category?: string | null;
  location?: string | null;
  specialties?: string[];
}

export default function VendorShowcase() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setIsLoggedIn(!!user);
      } catch (error) {
        console.error("Error checking auth:", error);
        setIsLoggedIn(false);
      }
    };

    checkAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchFeaturedVendors = async () => {
      try {
        setVendorsLoading(true);
        
        // Fetch featured vendors from API route (works for authenticated and unauthenticated users)
        // Add cache-busting query param to ensure fresh data
        const response = await fetch(`/api/featured-vendors?t=${Date.now()}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch featured vendors");
        }

        const { vendors: data } = await response.json();

        // Transform data to match Vendor interface
        interface VendorData {
          id: string;
          name?: string | null;
          featured_image?: string | null;
          featured_description?: string | null;
          category?: string | null;
          location?: string | null;
          specialties?: string[];
          [key: string]: unknown;
        }
        const featuredVendors: Vendor[] = (data || []).map((vendor: VendorData) => ({
          id: vendor.id,
          name: vendor.name || "Unknown Vendor",
          image: vendor.featured_image || null,
          description: vendor.featured_description || null,
          status: "Available", // Default status
          category: vendor.category || null,
          location: vendor.location || null,
          specialties: vendor.specialties || [],
        }));

        setVendors(featuredVendors);
      } catch (error) {
        console.error("Error fetching featured vendors:", error);
        setVendors([]);
      } finally {
        setVendorsLoading(false);
      }
    };

    fetchFeaturedVendors();

    // Listen for service profile updates
    const handleServiceProfileUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('Service profile updated event received in VendorShowcase:', customEvent.detail);
      // Immediately refetch without delay for user-initiated updates
      fetchFeaturedVendors();
    };
    
    window.addEventListener('vendor-service-profile-updated', handleServiceProfileUpdate);

    const serviceProfilesChannel = supabase
      .channel("vendor_service_profiles_showcase_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "vendor_service_profiles",
        },
        () => {
          fetchFeaturedVendors();
        }
      )
      .subscribe();

    const featuredProfilesChannel = supabase
      .channel("featured_vendor_profiles_changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
        },
        () => {
          fetchFeaturedVendors();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('vendor-service-profile-updated', handleServiceProfileUpdate);
      serviceProfilesChannel.unsubscribe();
      featuredProfilesChannel.unsubscribe();
    };
  }, []);

  const handleContact = () => {
    if (!isLoggedIn) {
      // Redirect to registration if not logged in
      window.location.href = "/register";
    } else {
      // Navigate to explore page where users can find and contact vendors
      window.location.href = "/explore";
    }
  };

  return (
    <section id="vendor-showcase" className="py-16 px-6 bg-hospineil-light-bg">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-header italic tracking-wide capitalize mb-4">
            Featured Vendors
          </h2>
          <p className="text-lg text-gray-800 font-body">
            Discover our top-rated vendors ready to serve you
          </p>
        </div>

        {/* Vendor Cards Grid */}
        {vendorsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hospineil-primary mx-auto mb-4"></div>
              <p className="text-gray-800 font-body">Loading featured vendors...</p>
            </div>
          </div>
        ) : vendors.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-800 font-body">No featured vendors at this time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {vendors.map((vendor) => (
              <div
                key={vendor.id}
                className="bg-white rounded-2xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-105 border border-gray-100 hover:border-hospineil-accent/30"
              >
                {/* Vendor Image */}
                <div className="relative w-full h-48 overflow-hidden bg-gray-200">
                  {vendor.image ? (
                    <Image
                      src={vendor.image}
                      alt={vendor.name}
                      fill
                      className="object-cover"
                      loading="lazy"
                      quality={85}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      placeholder="blur"
                      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                      <span className="text-4xl font-bold text-gray-400">
                        {vendor.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Vendor Info */}
                <div className="p-6">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-xl font-bold text-gray-800 font-header">
                      {vendor.name}
                    </h3>
                    {vendor.category && (
                      <span className="px-2 py-1 bg-hospineil-primary/10 text-hospineil-primary text-xs font-semibold rounded-full">
                        {vendor.category.replace("_", " ")}
                      </span>
                    )}
                  </div>
                  {vendor.description && (
                    <p className="text-sm text-gray-600 font-body mb-3 line-clamp-2">
                      {vendor.description}
                    </p>
                  )}
                  {(vendor.category === "chef" || vendor.category === "home_cook") && vendor.location && (
                    <p className="text-sm text-gray-500 font-body mb-2 flex items-center gap-1">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      <span>{vendor.location}</span>
                    </p>
                  )}
                  {(vendor.category === "chef" || vendor.category === "home_cook") &&
                    (vendor.specialties?.length || 0) > 0 && (
                      <p className="text-sm text-gray-500 font-body mb-3">
                        {vendor.specialties?.join(", ")}
                      </p>
                    )}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 bg-hospineil-primary rounded-full"></span>
                    <span className="text-sm text-gray-800 font-body">
                      {vendor.status}
                    </span>
                  </div>

                  {/* Contact Button */}
                  <Button
                    onClick={handleContact}
                    className="w-full bg-hospineil-accent text-hospineil-light-bg hover:bg-hospineil-accent-hover focus:ring-2 focus:ring-hospineil-primary focus:ring-offset-2 transition-all duration-300 hover:scale-105 hover:shadow-lg font-button font-medium"
                  >
                    Contact
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

