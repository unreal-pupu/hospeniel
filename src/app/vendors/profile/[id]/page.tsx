"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Star } from "lucide-react";
import VerifiedBadge from "@/components/VerifiedBadge";
import { supabase } from "@/lib/supabaseClient";
import { useCart } from "@/app/context/CartContex";
import { throttle, ThrottleDelays } from "@/lib/clientThrottle";
import ServiceRequestDialog from "@/components/ServiceRequestDialog";
import { MenuItemCard, MenuItemWithVendor } from "@/components/menu/MenuItemCard";
import { getCategoryLabel } from "@/lib/vendorCategories";

interface VendorRow {
  id: string | null;
  name?: string | null;
  business_name?: string | null;
  image_url?: string | null;
  location?: string | null;
  profile_id?: string | null;
  description?: string | null;
  category?: string | null;
  verified?: boolean | null;
  is_premium?: boolean | null;
  subscription_plan?: string | null;
}

interface ProfileRow {
  id: string;
  name: string | null;
  location: string | null;
  category: string | null;
  is_premium?: boolean | null;
  subscription_plan?: string | null;
}

interface VendorProfile {
  profileId: string;
  vendorRecordId: string | null;
  name: string;
  imageUrl: string | null;
  location: string | null;
  description: string | null;
  category: string | null;
  verified: boolean;
  isPremium: boolean;
  subscriptionPlan: string;
}

interface ServiceRequestState {
  open: boolean;
  vendorId: string;
  vendorName: string;
  isPremium: boolean;
  subscriptionPlan?: string;
}

interface VendorRating {
  id: string;
  vendor_id: string | number;
  user_id: string;
  rating: number;
  review: string | null;
  created_at: string;
}

interface MenuItemRow {
  id: string;
  vendor_id: string;
  title: string | null;
  description: string | null;
  price: number | string | null;
  image_url: string | null;
  availability: boolean | string | null;
}

function normalizeRouteParam(param: string | string[] | undefined) {
  if (!param) return "";
  if (Array.isArray(param)) return param[0] ?? "";
  return param;
}

function resolveVendorName(profile: ProfileRow | null, vendor: VendorRow | null) {
  const profileName = profile?.name?.trim();
  if (profileName) return profileName;
  const businessName = vendor?.business_name?.trim();
  if (businessName) return businessName;
  const vendorName = vendor?.name?.trim();
  if (vendorName) return vendorName;
  return "Vendor";
}

function toMenuItemWithVendor(item: MenuItemRow, vendor: VendorProfile): MenuItemWithVendor {
  return {
    id: String(item.id),
    vendor_id: String(item.vendor_id),
    title: item.title || "Menu Item",
    description: item.description || "",
    price: typeof item.price === "number" ? item.price : Number(item.price || 0),
    image_url: item.image_url || "/placeholder-image.png",
    availability: item.availability ?? false,
    vendors: {
      id: vendor.profileId,
      name: vendor.name,
      image_url: vendor.imageUrl,
      location: vendor.location,
      category: vendor.category,
      description: vendor.description,
      verified: vendor.verified,
      is_premium: vendor.isPremium,
      subscription_plan: vendor.subscriptionPlan,
    },
  };
}

export default function VendorProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { addToCart } = useCart();
  const vendorProfileId = normalizeRouteParam(params?.id);

  const [vendor, setVendor] = useState<VendorProfile | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItemWithVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [serviceRequestDialog, setServiceRequestDialog] = useState<ServiceRequestState | null>(null);
  const [ratings, setRatings] = useState<VendorRating[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [selectedRating, setSelectedRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [currentUserRatingId, setCurrentUserRatingId] = useState<string | null>(null);
  const [ratingMessage, setRatingMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const ratingContainerRef = useRef<HTMLDivElement | null>(null);

  const resolveVendorRecordId = async () => {
    if (vendor?.vendorRecordId) return vendor.vendorRecordId;
    try {
      const lookupResponse = await fetch(`/api/vendor-lookup?profile_id=${vendorProfileId}`);
      const lookupPayload = await lookupResponse.json();
      if (lookupResponse.ok && lookupPayload?.success && lookupPayload.vendor_id) {
        const resolved = String(lookupPayload.vendor_id);
        setVendor((prev) => (prev ? { ...prev, vendorRecordId: resolved } : prev));
        return resolved;
      }
      console.warn("Vendor lookup failed:", lookupPayload);
    } catch (lookupError) {
      console.warn("Failed to resolve vendor record id:", lookupError);
    }
    return null;
  };

  useEffect(() => {
    if (!vendorProfileId) {
      setLoading(false);
      return;
    }

    async function fetchVendorProfile() {
      try {
        setLoading(true);

        const { data: vendorData } = await supabase
          .from("vendors")
          .select("id, name, business_name, image_url, location, profile_id, description, category, is_premium, subscription_plan, verified")
          .eq("profile_id", vendorProfileId)
          .maybeSingle();

        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, name, location, category, is_premium, subscription_plan, verified")
          .eq("id", vendorProfileId)
          .maybeSingle();

        const resolvedName = resolveVendorName(profileData as ProfileRow | null, vendorData as VendorRow | null);
        let resolvedVendorRecordId = vendorData?.id ? String(vendorData.id) : null;

        if (!resolvedVendorRecordId) {
          try {
            const lookupResponse = await fetch(`/api/vendor-lookup?profile_id=${vendorProfileId}`);
            const lookupPayload = await lookupResponse.json();
            if (lookupResponse.ok && lookupPayload?.success && lookupPayload.vendor_id) {
              resolvedVendorRecordId = String(lookupPayload.vendor_id);
            }
          } catch (lookupError) {
            console.warn("Failed to resolve vendor record id:", lookupError);
          }
        }

        const vendorProfile: VendorProfile = {
          profileId: vendorProfileId,
          vendorRecordId: resolvedVendorRecordId,
          name: resolvedName,
          imageUrl: vendorData?.image_url || null,
          location: vendorData?.location || profileData?.location || null,
          description: vendorData?.description || null,
          category: profileData?.category || vendorData?.category || null,
          verified: Boolean(profileData?.verified ?? vendorData?.verified),
          isPremium: Boolean(profileData?.is_premium ?? vendorData?.is_premium),
          subscriptionPlan: profileData?.subscription_plan || vendorData?.subscription_plan || "free_trial",
        };

        setVendor(vendorProfile);

        const { data: menuData, error: menuError } = await supabase
          .from("menu_items")
          .select("id, vendor_id, title, description, price, image_url, availability")
          .eq("vendor_id", vendorProfileId)
          .order("created_at", { ascending: false });

        if (menuError) {
          console.error("Error fetching vendor menu items:", menuError);
          setMenuItems([]);
          return;
        }

        const items = (menuData || []).map((item: MenuItemRow) =>
          toMenuItemWithVendor(item, vendorProfile)
        );
        setMenuItems(items);
      } catch (error) {
        console.error("Error loading vendor profile:", error);
        setMenuItems([]);
      } finally {
        setLoading(false);
      }
    }

    fetchVendorProfile();
  }, [vendorProfileId]);

  useEffect(() => {
    const fetchRatings = async () => {
      if (!vendor?.vendorRecordId) {
        setRatings([]);
        setAverageRating(0);
        setRatingCount(0);
        return;
      }

      const { data, error } = await supabase
        .from("vendor_ratings")
        .select("id, vendor_id, user_id, rating, review, created_at")
        .eq("vendor_id", vendor.vendorRecordId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching vendor ratings:", error);
        return;
      }

      const ratingRows = (data || []) as VendorRating[];
      setRatings(ratingRows);

      const total = ratingRows.reduce((sum, row) => sum + (row.rating || 0), 0);
      const count = ratingRows.length;
      setAverageRating(count > 0 ? total / count : 0);
      setRatingCount(count);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const existing = ratingRows.find((row) => row.user_id === user.id);
        if (existing) {
          setSelectedRating(existing.rating);
          setReviewText(existing.review || "");
          setCurrentUserRatingId(existing.id);
        }
      }
    };

    fetchRatings();
  }, [vendor?.vendorRecordId]);

  const handleSubmitRating = async () => {
    const vendorRecordId = vendor?.vendorRecordId || (await resolveVendorRecordId());
    if (!vendorRecordId) {
      setRatingMessage({
        type: "error",
        text: "Unable to submit a rating for this vendor at the moment. Please try again later.",
      });
      console.warn("[Vendor Rating] Missing vendor record id", {
        profileId: vendor?.profileId,
        vendorRecordId: vendor?.vendorRecordId,
      });
      return;
    }
    if (selectedRating < 1 || selectedRating > 5) {
      setRatingMessage({ type: "error", text: "Please select a rating between 1 and 5." });
      return;
    }

    setSubmittingRating(true);
    setRatingMessage({ type: "info", text: "Submitting rating..." });
    try {
      console.log("[Vendor Rating] Submitting rating", {
        vendor_id: vendorRecordId,
        rating: selectedRating,
        review: reviewText?.trim() || null,
      });
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session?.access_token) {
        setRatingMessage({ type: "error", text: "Please log in to rate this vendor." });
        console.warn("[Vendor Rating] Missing session/token", sessionError);
        return;
      }

      const response = await fetch("/api/vendor-ratings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          vendor_id: vendorRecordId,
          rating: selectedRating,
          review: reviewText.trim() || null,
        }),
      });

      const payload = await response.json();
      console.log("[Vendor Rating] API response", {
        status: response.status,
        ok: response.ok,
        payload,
      });
      if (!response.ok || !payload.success) {
        setRatingMessage({
          type: "error",
          text: payload.error || "Failed to submit rating. Please try again.",
        });
        console.warn("[Vendor Rating] Submission failed:", payload);
        return;
      }

      const ratingRows = (payload.ratings || []) as VendorRating[];
      setRatings(ratingRows);
      setAverageRating(payload.average || 0);
      setRatingCount(payload.count || 0);
      setCurrentUserRatingId(payload.current_rating_id || null);
      setRatingMessage({ type: "success", text: "Thanks for rating this vendor!" });
    } catch (error) {
      console.error("Unexpected error submitting rating:", error);
      setRatingMessage({ type: "error", text: "Failed to submit rating. Please try again." });
    } finally {
      setSubmittingRating(false);
    }
  };

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const container = ratingContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const withinBounds =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (!withinBounds) return;

      const target = event.target as Node | null;
      const containsTarget = target ? container.contains(target) : false;
      if (!containsTarget) {
        const topElement = document.elementFromPoint(event.clientX, event.clientY);
        console.warn("[Vendor Rating] Overlay detected over rating section:", topElement);
        setRatingMessage({
          type: "error",
          text: "Click blocked by an overlay. Please close any open dialogs and try again.",
        });
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, []);

  const handleAddToCart = useMemo(
    () =>
      throttle(async (...args: unknown[]) => {
        const [itemId, vendorId] = args;
        if (typeof itemId !== "string" || typeof vendorId !== "string") {
          console.error("Invalid arguments for addToCart");
          return;
        }
        try {
          setAddingToCart(itemId);
          if (!vendorId) {
            alert("Invalid vendor information. Please try again.");
            return;
          }
          await addToCart(itemId, vendorId, 1);
          const toast = document.createElement("div");
          toast.className =
            "fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in slide-in-from-right";
          toast.textContent = "✓ Item added to cart!";
          document.body.appendChild(toast);
          setTimeout(() => {
            if (document.body.contains(toast)) {
              document.body.removeChild(toast);
            }
          }, 3000);
        } catch (error) {
          console.error("Error adding to cart:", error);
          const errorMessage = error instanceof Error ? error.message : "";
          if (errorMessage.includes("log in")) {
            alert("Please log in to add items to cart.");
            router.push("/loginpage");
          } else {
            const errMsg =
              error instanceof Error
                ? error.message
                : "Failed to add item to cart. Please try again.";
            alert(errMsg);
          }
        } finally {
          setAddingToCart(null);
        }
      }, ThrottleDelays.ADD_TO_CART),
    [addToCart, router]
  );

  const placeOrder = useMemo(
    () =>
      throttle(async (...args: unknown[]) => {
        const [menuItemArg] = args;
        if (!menuItemArg || typeof menuItemArg !== "object") {
          console.error("Invalid menuItem argument for placeOrder");
          return;
        }

        const menuItem = menuItemArg as MenuItemWithVendor;

        try {
          setPlacingOrder(true);
          const { data: { user }, error: userError } = await supabase.auth.getUser();

          if (userError && user) {
            console.warn("getUser warning with session user present:", userError.message);
          }

          if (!menuItem.vendor_id) {
            alert("Invalid vendor information. Please try again.");
            setPlacingOrder(false);
            return;
          }

          if (
            !menuItem.vendor_id.match(
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            )
          ) {
            console.error("Invalid vendor_id:", menuItem.vendor_id);
            alert("Invalid vendor information. Please try again.");
            setPlacingOrder(false);
            return;
          }

          if (!menuItem.id) {
            alert("Invalid product information. Please try again.");
            setPlacingOrder(false);
            return;
          }

          if (
            !menuItem.id.match(
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            )
          ) {
            console.error("Invalid product_id:", menuItem.id);
            alert("Invalid product information. Please try again.");
            setPlacingOrder(false);
            return;
          }

          if (!menuItem.price || menuItem.price <= 0) {
            alert("Invalid product price. Please try again.");
            setPlacingOrder(false);
            return;
          }

          let orderData: {
            user_id?: string;
            vendor_id: string;
            product_id: string;
            quantity: number;
            total_price: number;
            status: string;
          };

          if (user) {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
              alert("Session expired. Please log in again.");
              router.push("/loginpage");
              setPlacingOrder(false);
              return;
            }

            if (
              !user.id ||
              typeof user.id !== "string" ||
              !user.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
            ) {
              console.error("Invalid user.id:", user.id);
              alert("Invalid user account. Please log out and log in again.");
              setPlacingOrder(false);
              return;
            }

            orderData = {
              user_id: user.id,
              vendor_id: menuItem.vendor_id,
              product_id: menuItem.id,
              quantity: 1,
              total_price: menuItem.price,
              status: "Pending",
            };
          } else {
            // Guest: proceed to /payment; Paystack + verify use guest_id from checkout
            orderData = {
              vendor_id: menuItem.vendor_id,
              product_id: menuItem.id,
              quantity: 1,
              total_price: menuItem.price,
              status: "Pending",
            };
          }

          if (typeof window !== "undefined") {
            sessionStorage.setItem("directOrderData", JSON.stringify([orderData]));
            sessionStorage.setItem("directOrderSource", "explore");
          }

          router.push("/payment");
        } catch (error) {
          console.error("Unexpected error placing order:", error);
          const errorMessage = error instanceof Error ? error.message : "Please try again";
          alert(`An unexpected error occurred: ${errorMessage}`);
        } finally {
          setPlacingOrder(false);
        }
      }, ThrottleDelays.BUTTON_CLICK),
    [router]
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen text-gray-600">
        Loading vendor...
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-gray-600 gap-4">
        <p>Vendor not found.</p>
        <Link href="/explore" className="text-hospineil-primary hover:text-hospineil-accent">
          Back to Explore
        </Link>
      </div>
    );
  }

  const isChefOrHomeCook = vendor.category === "chef" || vendor.category === "home_cook";

  return (
    <>
      <section className="w-full min-h-screen px-6 md:px-12 lg:px-20 py-20 bg-hospineil-base-bg">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <Link
              href="/explore"
              className="text-hospineil-primary hover:text-hospineil-accent font-medium"
            >
              ← Back to Explore
            </Link>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-6 mb-12">
            <div className="w-32 h-32 relative rounded-full overflow-hidden shadow-md bg-gray-100">
              <Image
                src={vendor.imageUrl || "/default-vendor.png"}
                alt={vendor.name}
                fill
                className="object-cover"
              />
            </div>
            <div className="space-y-2 text-center md:text-left">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 font-header">
              <span className="inline-flex items-center gap-2">
                {vendor.name}
                <VerifiedBadge verified={vendor.verified} className="h-5 w-5 text-blue-600" />
              </span>
              </h1>
              {vendor.description && (
                <p className="text-lg text-gray-600 font-body">{vendor.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start">
                {vendor.category && (
                  <span className="inline-block bg-hospineil-accent/10 text-hospineil-accent px-3 py-1 rounded-full text-sm font-medium">
                    {getCategoryLabel(vendor.category)}
                  </span>
                )}
                {vendor.location && (
                  <span className="inline-flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    {vendor.location}
                  </span>
                )}
                {ratingCount > 0 && (
                  <span className="inline-flex items-center gap-2 text-sm text-gray-600">
                    <span>⭐ {averageRating.toFixed(1)}</span>
                    <span>({ratingCount} reviews)</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-semibold mb-6 text-gray-800 font-header">
            Menu Items
          </h2>

          {menuItems.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <p className="text-gray-500 text-lg">No menu items yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {menuItems.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  isAddingToCart={addingToCart === item.id}
                  isPlacingOrder={placingOrder}
                  onAddToCart={handleAddToCart}
                  onPlaceOrder={placeOrder}
                  onRequestService={(vendorId, vendorName, subscriptionPlan) =>
                    setServiceRequestDialog({
                      open: true,
                      vendorId,
                      vendorName,
                      isPremium: vendor.isPremium,
                      subscriptionPlan,
                    })
                  }
                />
              ))}
            </div>
          )}

          <div className="mt-12 relative z-[60] pointer-events-auto">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 font-header">
              Rate this Vendor
            </h2>
            <div
              className="bg-white rounded-xl shadow-sm p-6 space-y-4 pointer-events-auto"
              ref={ratingContainerRef}
              onClickCapture={() => {
                if (!ratingMessage) {
                  setRatingMessage({ type: "info", text: "Click detected. Submitting rating..." });
                }
              }}
            >
              {ratingMessage && (
                <div
                  className={`rounded-lg px-4 py-2 text-sm ${
                    ratingMessage.type === "success"
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : ratingMessage.type === "error"
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-blue-50 text-blue-700 border border-blue-200"
                  }`}
                >
                  {ratingMessage.text}
                </div>
              )}
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedRating(value)}
                    className="text-yellow-500 hover:scale-105 transition-transform"
                    aria-label={`Rate ${value} stars`}
                  >
                    <Star className={value <= selectedRating ? "h-6 w-6 fill-yellow-400" : "h-6 w-6"} />
                  </button>
                ))}
              </div>
              <textarea
                className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-hospineil-primary/40"
                rows={3}
                placeholder="Leave an optional review"
                value={reviewText}
                onChange={(event) => setReviewText(event.target.value)}
              />
              <button
                type="button"
                onPointerDown={() => {
                  console.log("[Vendor Rating] Pointer down on submit button");
                  setRatingMessage({ type: "info", text: "Submitting rating..." });
                }}
                onClick={() => {
                  console.log("[Vendor Rating] Clicked submit button");
                  handleSubmitRating();
                }}
                disabled={submittingRating}
                className="bg-hospineil-primary text-white px-4 py-2 rounded-lg hover:bg-hospineil-primary/90 transition-colors pointer-events-auto relative z-10"
              >
                {submittingRating ? "Submitting..." : currentUserRatingId ? "Update Rating" : "Submit Rating"}
              </button>
            </div>
          </div>

          {ratings.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xl font-semibold mb-4 text-gray-800 font-header">
                Recent Reviews
              </h3>
              <div className="space-y-4">
                {ratings.slice(0, 5).map((rating) => (
                  <div key={rating.id} className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                      <span>⭐ {rating.rating}</span>
                      <span>•</span>
                      <span>{new Date(rating.created_at).toLocaleDateString()}</span>
                    </div>
                    {rating.review && (
                      <p className="text-gray-700 text-sm">{rating.review}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {serviceRequestDialog && (
        <ServiceRequestDialog
          open={serviceRequestDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              setServiceRequestDialog(null);
            } else {
              setServiceRequestDialog({ ...serviceRequestDialog, open });
            }
          }}
          vendorId={serviceRequestDialog.vendorId}
          vendorName={serviceRequestDialog.vendorName}
          isPremium={serviceRequestDialog.isPremium}
          subscriptionPlan={serviceRequestDialog.subscriptionPlan}
          isChefOrHomeCook={isChefOrHomeCook}
        />
      )}
    </>
  );
}
