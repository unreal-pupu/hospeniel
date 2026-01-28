"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useCart } from "@/app/context/CartContex";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Loader2 } from "lucide-react";

interface MenuItem {
  id: string;
  vendor_id: string;
  title: string;
  description: string;
  price: number;
  image_url: string | null;
  availability: boolean | string;
  vendors?: {
    id: string;
    name: string;
    image_url: string | null;
    location?: string | null;
  };
}

export default function ProductsShowcase() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const { addToCart } = useCart();
  const router = useRouter();

  useEffect(() => {
    const fetchMenuItems = async () => {
      try {
        setLoading(true);
        
        // Fetch available menu items (no auth required)
        const { data: menuData, error: menuError } = await supabase
          .from("menu_items")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(12); // Show 12 items on landing page

        if (menuError) {
          console.error("Error fetching menu items:", menuError);
          setMenuItems([]);
          setLoading(false);
          return;
        }

        if (!menuData || menuData.length === 0) {
          setMenuItems([]);
          setLoading(false);
          return;
        }

        // Get unique vendor IDs
        interface MenuDataItem {
          vendor_id: string;
          [key: string]: unknown;
        }
        interface VendorData {
          id: string;
          profile_id: string;
          name?: string | null;
          business_name?: string | null;
          image_url?: string | null;
          location?: string | null;
          [key: string]: unknown;
        }
        interface ProfileData {
          id: string;
          name?: string | null;
          location?: string | null;
          [key: string]: unknown;
        }
        const vendorIds = [...new Set(menuData.map((item: MenuDataItem) => item.vendor_id).filter(Boolean))];

        if (vendorIds.length === 0) {
          setMenuItems(menuData);
          setLoading(false);
          return;
        }

        // Fetch vendor information
        const { data: vendorsData } = await supabase
          .from("vendors")
          .select("id, name, business_name, image_url, location, profile_id")
          .in("profile_id", vendorIds);

        // Also fetch profiles for vendor names
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, name, location")
          .in("id", vendorIds)
          .eq("role", "vendor");

        // Create vendor map
        const vendorMap = new Map();
        if (vendorsData) {
          vendorsData.forEach((vendor: VendorData) => {
            if (vendor.profile_id) {
              const profile = profilesData?.find((p: ProfileData) => p.id === vendor.profile_id);
              vendorMap.set(vendor.profile_id, {
                id: vendor.id,
                name: profile?.name || vendor.business_name || vendor.name || "Vendor",
                image_url: vendor.image_url,
                location: vendor.location || profile?.location,
              });
            }
          });
        }

        // Combine menu items with vendor information
        const itemsWithVendors: MenuItem[] = (menuData || [])
          .filter((item: MenuDataItem) => {
            // Only show available items
            return item.availability === true || 
                   item.availability === "available" ||
                   item.availability === "Available";
          })
          .map((item: MenuDataItem) => ({
            id: String(item.id),
            vendor_id: String(item.vendor_id),
            title: String(item.title),
            description: typeof item.description === "string" ? item.description : "",
            price: typeof item.price === "number" ? item.price : Number(item.price || 0),
            image_url: typeof item.image_url === "string" ? item.image_url : null,
            availability: item.availability as MenuItem["availability"],
            vendors: vendorMap.get(item.vendor_id),
          }));

        setMenuItems(itemsWithVendors);
      } catch (error) {
        console.error("Error fetching menu items:", error);
        setMenuItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMenuItems();
  }, []);

  const handleAddToCart = async (item: MenuItem) => {
    try {
      setAddingToCart(item.id);
      await addToCart(item.id, item.vendor_id, 1);
      // Success - cart context will handle the update
      // Show success message (optional)
    } catch (error) {
      console.error("Error adding to cart:", error);
      // Only show alert if it's not a localStorage error (which is handled silently)
      const errorMessage = error instanceof Error ? error.message : "";
      if (errorMessage && !errorMessage.includes("localStorage")) {
        alert(errorMessage || "Failed to add item to cart. Please try again.");
      }
    } finally {
      setAddingToCart(null);
    }
  };

  if (loading) {
    return (
      <section className="w-full pt-8 sm:pt-12 md:pt-16 pb-16 bg-hospineil-base-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center py-12">
            <Loader2 className="animate-spin text-hospineil-primary h-8 w-8" />
          </div>
        </div>
      </section>
    );
  }

  if (menuItems.length === 0) {
    return null; // Don't show section if no items
  }

  return (
    <section className="w-full pt-8 sm:pt-12 md:pt-16 pb-16 bg-hospineil-base-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-hospineil-primary font-header mb-4">
            Featured Products
          </h2>
          <p className="text-lg text-gray-600 font-body max-w-2xl mx-auto">
            Discover delicious meals, treats, and culinary delights from our amazing vendors
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {menuItems.map((item) => (
            <Card
              key={item.id}
              className="bg-white rounded-2xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.01] border border-gray-100 hover:border-hospineil-accent/30 flex flex-col group"
            >
              <div className="relative w-full h-64 sm:h-60 bg-gray-100 overflow-hidden">
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt={item.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    loading="lazy"
                    quality={85}
                    placeholder="blur"
                    blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200">
                    <span className="text-gray-400 text-sm">No Image</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-black/0 to-black/0" />
              </div>
              
              <CardContent className="p-5 pt-4 flex flex-col flex-grow">
                <div className="mb-2">
                  {item.vendors?.name && (
                    <p className="text-xs text-gray-500 font-body mb-1">
                      {item.vendors.name}
                    </p>
                  )}
                  <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2 font-header">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-2 font-body">
                    {item.description || "Delicious meal"}
                  </p>
                </div>

                <div className="mt-auto">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold text-hospineil-primary font-header">
                      ₦{item.price.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <Button
                    onClick={() => handleAddToCart(item)}
                    disabled={addingToCart === item.id}
                    className="w-full bg-hospineil-primary text-white hover:bg-hospineil-primary/90 transition-all duration-300 hover:scale-105 font-button"
                  >
                    {addingToCart === item.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Add to Cart
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-8">
          <Button
            onClick={() => router.push("/explore")}
            variant="outline"
            className="rounded-full px-8 py-2 bg-white border-2 border-hospineil-primary text-hospineil-primary hover:bg-hospineil-primary hover:text-white transition-all duration-300 font-button"
          >
            View All Products
          </Button>
        </div>
      </div>
    </section>
  );
}

