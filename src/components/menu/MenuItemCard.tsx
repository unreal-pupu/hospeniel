"use client";

import Image from "next/image";
import { MessageSquare, UtensilsCrossed } from "lucide-react";
import { getCategoryLabel, vendorCategoryMayReceiveServiceRequests } from "@/lib/vendorCategories";
import VerifiedBadge from "@/components/VerifiedBadge";

export interface MenuItemVendorInfo {
  id: string | null;
  name: string;
  image_url: string | null;
  location?: string | null;
  category?: string | null;
  description?: string | null;
  verified?: boolean;
}

export interface MenuItemWithVendor {
  id: string;
  vendor_id: string;
  title: string;
  description: string;
  price: number;
  image_url: string;
  availability: boolean | string;
  vendors?: MenuItemVendorInfo;
}

interface MenuItemCardProps {
  item: MenuItemWithVendor;
  isAddingToCart?: boolean;
  isPlacingOrder?: boolean;
  onAddToCart: (itemId: string, vendorId: string) => void;
  onPlaceOrder: (item: MenuItemWithVendor) => void;
  onRequestService?: (vendorId: string, vendorName: string, vendorCategory?: string | null) => void;
}

function isAvailableMenuItem(availability: MenuItemWithVendor["availability"]) {
  if (availability === true) return true;
  if (typeof availability === "string") {
    return availability.toLowerCase() === "available";
  }
  return false;
}

export function MenuItemCard({
  item,
  isAddingToCart,
  isPlacingOrder,
  onAddToCart,
  onPlaceOrder,
  onRequestService,
}: MenuItemCardProps) {
  const isAvailable = isAvailableMenuItem(item.availability);

  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.01] border border-gray-100 hover:border-hospineil-accent/30 group flex flex-col">
      <div className="relative w-full h-64 sm:h-60 overflow-hidden bg-gray-100">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "/placeholder-image.png";
            }}
            unoptimized
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <UtensilsCrossed className="h-12 w-12 text-gray-400" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-black/0 to-black/0" />
        <div className="absolute top-3 right-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold shadow-md ${
              isAvailable ? "bg-green-500 text-white" : "bg-red-500 text-white"
            }`}
          >
            {isAvailable ? "Available" : "Out of Stock"}
          </span>
        </div>
      </div>

      <div className="p-5">
        {item.vendors ? (
          <div className="mb-3 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              {item.vendors.image_url ? (
                <div className="relative w-8 h-8 rounded-full overflow-hidden border border-gray-200">
                  <Image
                    src={item.vendors.image_url}
                    alt={item.vendors.name || "Vendor"}
                    fill
                    className="object-cover"
                    sizes="32px"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "/default-vendor.png";
                    }}
                  />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
                  <UtensilsCrossed className="w-4 h-4 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate font-header flex items-center gap-1">
                  <span>
                    {item.vendors.name && item.vendors.name !== "Vendor Name Not Available"
                      ? item.vendors.name
                      : "Vendor"}
                  </span>
                  <VerifiedBadge verified={item.vendors.verified} />
                  {item.vendors.category && (
                    <span className="text-gray-500 font-normal">
                      {" "}
                      – {getCategoryLabel(item.vendors.category)}
                    </span>
                  )}
                </p>
                {item.vendors.location && (
                  <p className="text-xs text-gray-500 flex items-center gap-1 font-body">
                    <span>📍</span>
                    <span>{item.vendors.location}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-3 pb-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
                <UtensilsCrossed className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-xs text-gray-500 italic font-body">
                Loading vendor information...
              </p>
            </div>
          </div>
        )}

        <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2 font-header">
          {item.title}
        </h3>
        <p className="text-gray-600 text-sm mb-2 line-clamp-2 font-body">
          {item.description || "No description available"}
        </p>
        <div className="flex items-center justify-between mb-3">
          <p className="text-hospineil-primary font-bold text-xl font-header">
            ₦{item.price.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => onAddToCart(item.id, item.vendor_id)}
              disabled={!isAvailable || isAddingToCart}
              className={`flex-1 py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium font-button ${
                isAvailable
                  ? "bg-hospineil-primary text-white hover:bg-hospineil-primary/90 hover:scale-105"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              {isAddingToCart ? "Adding..." : isAvailable ? "Add to Cart" : "Out of Stock"}
            </button>
            <button
              onClick={() => onPlaceOrder(item)}
              disabled={isPlacingOrder || !isAvailable}
              className={`flex-1 py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium border-2 font-button ${
                isAvailable
                  ? "border-hospineil-accent text-hospineil-accent hover:bg-hospineil-accent hover:text-white hover:scale-105"
                  : "border-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              {isPlacingOrder ? "Placing..." : isAvailable ? "Order Now" : "Out of Stock"}
            </button>
          </div>

          {item.vendors &&
            item.vendor_id &&
            onRequestService &&
            vendorCategoryMayReceiveServiceRequests(item.vendors.category) && (
            <button
              onClick={() =>
                onRequestService(
                  item.vendors?.id ?? item.vendor_id,
                  item.vendors?.name || "Vendor",
                  item.vendors?.category ?? null
                )
              }
              className="w-full py-2 rounded-lg transition-all font-medium border-2 border-hospineil-primary text-hospineil-primary hover:bg-hospineil-primary hover:text-white flex items-center justify-center gap-2 font-button"
            >
              <MessageSquare className="h-4 w-4" />
              Request Service
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
