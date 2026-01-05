"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";

interface Vendor {
  id: string;
  name: string;
  image: string | null;
  description: string | null;
  status: string;
}

export default function VendorShowcase() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
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
      } finally {
        setLoading(false);
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
        const response = await fetch("/api/featured-vendors");
        
        if (!response.ok) {
          throw new Error("Failed to fetch featured vendors");
        }

        const { vendors: data } = await response.json();

        // Transform data to match Vendor interface
        const featuredVendors: Vendor[] = (data || []).map((vendor: any) => ({
          id: vendor.id,
          name: vendor.name || "Unknown Vendor",
          image: vendor.featured_image || null,
          description: vendor.featured_description || null,
          status: "Available", // Default status
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
  }, []);

  const handleContact = (vendorId: string) => {
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
                  <h3 className="text-xl font-bold text-gray-800 font-header mb-2">
                    {vendor.name}
                  </h3>
                  {vendor.description && (
                    <p className="text-sm text-gray-600 font-body mb-3 line-clamp-2">
                      {vendor.description}
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
                    onClick={() => handleContact(vendor.id)}
                    className="w-full bg-hospineil-accent text-hospineil-light-bg hover:bg-hospineil-accent-hover focus:ring-2 focus:ring-hospineil-primary focus:ring-offset-2 transition-all duration-300 hover:scale-105 hover:shadow-lg font-button font-medium"
                  >
                    {isLoggedIn ? "Contact" : "Register to Contact"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* View All Vendors Button */}
        <div className="text-center">
          <Link href="/vendor-listing">
            <Button className="bg-hospineil-accent text-hospineil-light-bg hover:bg-hospineil-accent-hover focus:ring-2 focus:ring-hospineil-primary focus:ring-offset-2 transition-all duration-300 hover:scale-105 hover:shadow-lg font-button font-medium px-8 py-3 rounded-full">
              View All Vendors
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

