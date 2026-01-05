"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

export type CartItem = {
  id: string; // cart_items.id or temporary ID for localStorage
  user_id?: string; // Optional for localStorage items
  vendor_id: string;
  product_id: string;
  quantity: number;
  price: number;
  created_at?: string;
  updated_at?: string;
  // Joined data
  menu_items?: {
    id: string;
    title: string;
    image_url: string;
    price: number;
  };
  vendors?: {
    id: string;
    name: string;
    image_url: string;
    location?: string;
  };
};

type Order = {
  id: string;
  items: CartItem[];
  total: number;
  date: string;
};

type CartContextType = {
  cartItems: CartItem[];
  cartCount: number;
  loading: boolean;
  addToCart: (productId: string, vendorId: string, quantity?: number) => Promise<void>;
  removeFromCart: (cartItemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>;
  placeOrder: () => void;
  refreshCart: () => Promise<void>;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

const LOCAL_STORAGE_CART_KEY = "hospineil_cart";

// Helper functions for localStorage cart
const getLocalStorageCart = (): CartItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_CART_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error reading localStorage cart:", error);
    return [];
  }
};

const setLocalStorageCart = (items: CartItem[]) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_CART_KEY, JSON.stringify(items));
  } catch (error) {
    console.error("Error saving localStorage cart:", error);
  }
};

const clearLocalStorageCart = () => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LOCAL_STORAGE_CART_KEY);
  } catch (error) {
    console.error("Error clearing localStorage cart:", error);
  }
};

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Calculate cart count (total quantity of all items)
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Fetch cart items from Supabase or localStorage
  const fetchCartItems = async () => {
    try {
      setLoading(true);

      // Get authenticated user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      const isAuth = !userError && !!user;
      setIsAuthenticated(isAuth);

      if (!isAuth) {
        // Load from localStorage for unauthenticated users
        const localCart = getLocalStorageCart();
        setCartItems(localCart);
        setLoading(false);
        return;
      }

      // Fetch cart items with related data
      const { data: cartData, error: cartError } = await supabase
        .from("cart_items")
        .select(`
          *,
          menu_items (
            id,
            title,
            image_url,
            price
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (cartError) {
        console.error("Error fetching cart items:", cartError);
        setCartItems([]);
        setLoading(false);
        return;
      }

      if (!cartData || cartData.length === 0) {
        setCartItems([]);
        setLoading(false);
        return;
      }

      // Get unique vendor IDs
      const vendorIds = [...new Set(cartData.map((item: any) => item.vendor_id))];

      // Fetch vendor information
      const { data: vendorsData, error: vendorsError } = await supabase
        .from("vendors")
        .select("id, name, image_url, location, profile_id")
        .in("profile_id", vendorIds);

      if (vendorsError) {
        console.error("Error fetching vendors:", vendorsError);
      }

      // Create a map of vendor_id (auth.users id) to vendor data
      const vendorsMap = new Map();
      if (vendorsData) {
        vendorsData.forEach((vendor: any) => {
          vendorsMap.set(vendor.profile_id, vendor);
        });
      }

      // Combine cart items with vendor information
      const cartItemsWithVendors = cartData.map((item: any) => {
        const vendor = vendorsMap.get(item.vendor_id);
        return {
          ...item,
          vendors: vendor
            ? {
                id: vendor.id,
                name: vendor.name,
                image_url: vendor.image_url,
                location: vendor.location,
              }
            : undefined,
        };
      });

      setCartItems(cartItemsWithVendors);
      
      // Sync localStorage cart to database if user just logged in
      const localCart = getLocalStorageCart();
      if (localCart.length > 0) {
        await syncLocalCartToDatabase(localCart, user.id);
        clearLocalStorageCart();
      }
    } catch (error) {
      console.error("Error fetching cart items:", error);
      // Fallback to localStorage if database fetch fails
      if (!isAuthenticated) {
        const localCart = getLocalStorageCart();
        setCartItems(localCart);
      } else {
        setCartItems([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Sync localStorage cart to database when user logs in
  const syncLocalCartToDatabase = async (localItems: CartItem[], userId: string) => {
    try {
      for (const item of localItems) {
        // Fetch product details to get current price
        const { data: product } = await supabase
          .from("menu_items")
          .select("id, price")
          .eq("id", item.product_id)
          .single();

        if (!product) continue;

        // Check if item already exists in database cart
        const { data: existingItem } = await supabase
          .from("cart_items")
          .select("*")
          .eq("user_id", userId)
          .eq("vendor_id", item.vendor_id)
          .eq("product_id", item.product_id)
          .single();

        if (existingItem) {
          // Update quantity
          await supabase
            .from("cart_items")
            .update({
              quantity: existingItem.quantity + item.quantity,
              price: product.price,
            })
            .eq("id", existingItem.id);
        } else {
          // Insert new item
          await supabase.from("cart_items").insert([
            {
              user_id: userId,
              vendor_id: item.vendor_id,
              product_id: item.product_id,
              quantity: item.quantity,
              price: product.price,
            },
          ]);
        }
      }
    } catch (error) {
      console.error("Error syncing local cart to database:", error);
    }
  };

  // Set up real-time subscription for cart changes and localStorage listener
  useEffect(() => {
    let mounted = true;

    const initializeCart = async () => {
      // Initial fetch
      await fetchCartItems();

      // Get authenticated user for realtime subscription
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !mounted) {
        // For unauthenticated users, listen to localStorage changes from other tabs
        const handleStorageChange = (e: StorageEvent) => {
          if (e.key === LOCAL_STORAGE_CART_KEY && mounted) {
            const localCart = getLocalStorageCart();
            setCartItems(localCart);
          }
        };

        window.addEventListener("storage", handleStorageChange);

        return () => {
          window.removeEventListener("storage", handleStorageChange);
        };
      }

      // Set up real-time subscription for authenticated users
      // Note: Real-time filters use PostgREST syntax
      const channel = supabase
        .channel(`cart-items-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "cart_items",
            filter: `user_id=eq.${user.id}`,
          },
          (payload: any) => {
            console.log("Cart change detected:", payload);
            // Refetch cart items when changes occur
            if (mounted) {
              fetchCartItems();
            }
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            console.log("Cart realtime subscription active");
          } else if (status === "CHANNEL_ERROR") {
            console.error("Cart realtime subscription error");
          } else {
            console.log("Cart realtime subscription status:", status);
          }
        });

      channelRef.current = channel;
    };

    initializeCart();

    // Cleanup on unmount
    return () => {
      mounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  // Add item to cart (works for both authenticated and unauthenticated users)
  const addToCart = async (
    productId: string,
    vendorId: string,
    quantity: number = 1
  ) => {
    try {
      // Get authenticated user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      const isAuth = !userError && !!user;

      // Fetch product details to get current price
      const { data: product, error: productError } = await supabase
        .from("menu_items")
        .select("id, price, title, image_url")
        .eq("id", productId)
        .single();

      if (productError || !product) {
        throw new Error("Product not found");
      }

      if (!isAuth) {
        // Store in localStorage for unauthenticated users
        const localCart = getLocalStorageCart();
        const existingItemIndex = localCart.findIndex(
          (item) => item.vendor_id === vendorId && item.product_id === productId
        );

        if (existingItemIndex >= 0) {
          // Update quantity
          localCart[existingItemIndex].quantity += quantity;
          localCart[existingItemIndex].price = product.price;
        } else {
          // Add new item
          const newItem: CartItem = {
            id: `local_${Date.now()}_${Math.random()}`,
            vendor_id: vendorId,
            product_id: productId,
            quantity: quantity,
            price: product.price,
            menu_items: {
              id: product.id,
              title: product.title,
              image_url: product.image_url || "",
              price: product.price,
            },
          };
          localCart.push(newItem);
        }

        setLocalStorageCart(localCart);
        setCartItems(localCart);
        return;
      }

      // User is authenticated - proceed with database cart
      // Check if item already exists in cart
      const { data: existingItem, error: checkError } = await supabase
        .from("cart_items")
        .select("*")
        .eq("user_id", user.id)
        .eq("vendor_id", vendorId)
        .eq("product_id", productId)
        .single();

      if (existingItem) {
        // Update quantity if item exists
        const { error: updateError } = await supabase
          .from("cart_items")
          .update({
            quantity: existingItem.quantity + quantity,
            price: product.price, // Update to current price
          })
          .eq("id", existingItem.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Insert new item
        const { error: insertError } = await supabase.from("cart_items").insert([
          {
            user_id: user.id,
            vendor_id: vendorId,
            product_id: productId,
            quantity: quantity,
            price: product.price,
          },
        ]);

        if (insertError) {
          throw insertError;
        }
      }

      // Real-time subscription will automatically update the cart
      // But we can also refetch to ensure consistency
      await fetchCartItems();
    } catch (error: any) {
      console.error("Error adding to cart:", error);
      throw error;
    }
  };

  // Remove item from cart
  const removeFromCart = async (cartItemId: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Remove from localStorage
        const localCart = getLocalStorageCart();
        const filtered = localCart.filter((item) => item.id !== cartItemId);
        setLocalStorageCart(filtered);
        setCartItems(filtered);
        return;
      }

      const { error } = await supabase
        .from("cart_items")
        .delete()
        .eq("id", cartItemId);

      if (error) {
        throw error;
      }

      // Real-time subscription will automatically update the cart
      await fetchCartItems();
    } catch (error: any) {
      console.error("Error removing from cart:", error);
      throw error;
    }
  };

  // Update item quantity
  const updateQuantity = async (cartItemId: string, quantity: number) => {
    try {
      if (quantity < 1) {
        // Remove item if quantity is 0 or less
        await removeFromCart(cartItemId);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Update in localStorage
        const localCart = getLocalStorageCart();
        const itemIndex = localCart.findIndex((item) => item.id === cartItemId);
        if (itemIndex >= 0) {
          localCart[itemIndex].quantity = quantity;
          setLocalStorageCart(localCart);
          setCartItems(localCart);
        }
        return;
      }

      const { error } = await supabase
        .from("cart_items")
        .update({ quantity: quantity })
        .eq("id", cartItemId);

      if (error) {
        throw error;
      }

      // Real-time subscription will automatically update the cart
      await fetchCartItems();
    } catch (error: any) {
      console.error("Error updating quantity:", error);
      throw error;
    }
  };

  // Clear entire cart
  const clearCart = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Clear localStorage
        clearLocalStorageCart();
        setCartItems([]);
        return;
      }

      const { error } = await supabase
        .from("cart_items")
        .delete()
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      // Real-time subscription will automatically update the cart
      await fetchCartItems();
    } catch (error: any) {
      console.error("Error clearing cart:", error);
      throw error;
    }
  };

  // Place order (legacy function, kept for compatibility)
  const placeOrder = () => {
    // This is now handled in the checkout page
    console.warn("placeOrder is deprecated. Use checkout page instead.");
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartCount,
        loading,
        addToCart,
        removeFromCart,
        clearCart,
        updateQuantity,
        placeOrder,
        refreshCart: fetchCartItems,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
