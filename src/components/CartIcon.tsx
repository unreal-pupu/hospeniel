"use client";

import Link from "next/link";
import { FiShoppingCart } from "react-icons/fi";
import { useCart } from "../app/context/CartContex";

interface CartIconProps {
  size?: number;
  className?: string;
  showBadge?: boolean;
}

export default function CartIcon({ size = 24, className = "", showBadge = true }: CartIconProps) {
  const cartContext = useCart();
  const cartCount = cartContext?.cartCount ?? 0;

  return (
    <Link 
      href="/cart" 
      className={`relative text-gray-700 hover:text-hospineil-primary transition-colors inline-flex items-center justify-center p-1 ${className}`}
      aria-label={`Shopping cart${cartCount > 0 ? ` (${cartCount} items)` : ''}`}
      title="View cart"
    >
      <FiShoppingCart size={size} className="flex-shrink-0" style={{ display: 'block', minWidth: `${size}px`, minHeight: `${size}px` }} />
      {showBadge && cartCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-hospineil-accent text-white rounded-full w-5 h-5 text-xs flex items-center justify-center font-semibold animate-pulse min-w-[20px] z-10">
          {cartCount > 99 ? "99+" : cartCount}
        </span>
      )}
    </Link>
  );
}





