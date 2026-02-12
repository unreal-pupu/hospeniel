"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FiShoppingCart, FiUser } from "react-icons/fi";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import NotificationBell from "./NotificationBell";
import CartIcon from "./CartIcon";
import Image from "next/image";

export default function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // ✅ Detect logged-in user
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAuth();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const isLandingPage = pathname === "/";
  const isExplorePage = pathname === "/explore";
  const isLoginPage = pathname === "/loginpage";
  const isRegisterPage = pathname === "/register";

  // ✅ Smooth scroll to section
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 100; // Account for fixed navbar height
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  // ✅ Detect active section on scroll
  useEffect(() => {
    if (!isLandingPage) return;

    const handleScroll = () => {
    const sections = ["home", "features", "pricing", "listing", "testimonials", "acceptableusepolicy", "faq"];
      const scrollPosition = window.scrollY + 100; // Offset for fixed navbar

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = document.getElementById(sections[i]);
        if (section) {
          const sectionTop = section.offsetTop;
          const sectionHeight = section.offsetHeight;

          if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
            setActiveSection(sections[i]);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Check on mount

    return () => window.removeEventListener("scroll", handleScroll);
  }, [isLandingPage]);

  // ✅ Hide Navbar completely on vendor and admin pages
  if (pathname.startsWith("/vendor") || pathname.startsWith("/admin")) return null;

  // ✅ Navigation links for landing page
  const landingPageLinks = [
    { id: "home", label: "Home" },
    { id: "features", label: "Features" },
    // { id: "pricing", label: "Pricing" },
    { id: "listing", label: "Listing" },
    { id: "testimonials", label: "Testimonials" },
    { id: "faq", label: "FAQ" },
  ];

  return (
    <nav className="bg-[#ffffff] shadow-sm fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
     <Link
  href="/"
  className="inline-block hover:opacity-80 transition-opacity duration-300"
  onClick={(e) => {
    if (isLandingPage) {
      e.preventDefault();
      scrollToSection("home");
    }
  }}
>
  <Image
    src="/Hospi.jpeg"
    alt="Hospeniel"
    width={120}  // adjust width
    height={40}  // adjust height
    priority
  />
</Link>


        {/* Landing page: show section links + Login + Signup */}
        {isLandingPage && (
          <>
            {/* Desktop Section Navigation Links */}
            <div className="hidden md:flex items-center gap-6">
              {landingPageLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => scrollToSection(link.id)}
                  className={`
                    text-sm font-medium transition-colors
                    ${
                      activeSection === link.id
                        ? "text-hospineil-primary border-b-2 border-hospineil-primary pb-1"
                        : "text-gray-800 hover:text-hospineil-primary"
                    }
                  `}
                >
                  {link.label}
                </button>
              ))}
            </div>

            {/* Mobile Menu Button and Cart Icon */}
            <div className="md:hidden flex items-center gap-3">
              {/* Cart Icon - visible on mobile */}
              <CartIcon size={22} />
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-gray-800 hover:text-hospineil-primary"
                aria-label="Toggle menu"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {mobileMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
            </div>

            {/* Auth Buttons and Cart Icon */}
            <div className="hidden md:flex items-center gap-6">
              <Link
                href="/loginpage"
                className="p-2 text-gray-800 hover:text-hospineil-primary transition-colors rounded-full hover:bg-gray-100"
                aria-label="Login"
              >
                <FiUser className="w-5 h-5" />
              </Link>
              <Link href="/register">
                <Button className="rounded-full px-5 py-2 bg-hospineil-accent text-hospineil-light-bg hover:bg-hospineil-accent-hover focus:ring-2 focus:ring-hospineil-primary focus:ring-offset-2 transition-all duration-200 border-2 border-hospineil-accent">Sign up</Button>
              </Link>
              {/* Cart Icon - visible to all users, placed after Signup button */}
              <CartIcon size={24} />
            </div>
          </>
        )}

        {/* Login and Register pages: show logo, opposite auth button, and cart icon */}
        {(isLoginPage || isRegisterPage) && (
          <div className="flex items-center gap-6 ml-auto">
            {/* Show Login link only on Register page */}
            {isRegisterPage && (
              <Link
                href="/loginpage"
                className="p-2 text-gray-800 hover:text-hospineil-primary transition-colors rounded-full hover:bg-gray-100"
                aria-label="Login"
              >
                <FiUser className="w-5 h-5" />
              </Link>
            )}
            
            {/* Show Sign Up button only on Login page */}
            {isLoginPage && (
              <Link href="/register">
                <Button className="rounded-full px-4 sm:px-5 py-2 bg-hospineil-accent text-hospineil-light-bg hover:bg-hospineil-accent-hover focus:ring-2 focus:ring-hospineil-primary focus:ring-offset-2 transition-all duration-200 border-2 border-hospineil-accent text-sm sm:text-base">Sign up</Button>
              </Link>
            )}
            
            {/* Cart Icon - visible to all users on login/register pages */}
            <CartIcon size={24} />
          </div>
        )}

        {/* Explore page: show Cart and Notifications */}
        {isExplorePage && (
          <div className="flex items-center gap-4">
            {isLoggedIn && (
              <NotificationBell userType="user" notificationsPageUrl="/notifications" />
            )}
            <CartIcon size={24} />
          </div>
        )}

        {/* Other pages (not landing, explore, login, register): show cart icon */}
        {!isLandingPage && !isExplorePage && !isLoginPage && !isRegisterPage && (
          <div className="flex items-center gap-4 ml-auto">
            {/* Cart Icon - visible to all users on other pages */}
            <CartIcon size={24} />
          </div>
        )}
      </div>

      {/* Mobile Menu Dropdown - Landing Page */}
      {isLandingPage && mobileMenuOpen && (
        <div className="md:hidden bg-[#ffffff] border-t border-gray-200 shadow-lg">
          <div className="px-6 py-4 space-y-3">
            {landingPageLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => {
                  scrollToSection(link.id);
                  setMobileMenuOpen(false);
                }}
                className={`
                  w-full text-left px-4 py-2 rounded-lg transition-colors
                  ${
                    activeSection === link.id
                      ? "bg-hospineil-light-bg text-hospineil-primary font-semibold"
                      : "text-gray-800 hover:bg-gray-50 hover:text-hospineil-primary"
                  }
                `}
              >
                {link.label}
              </button>
            ))}
            <div className="pt-4 border-t border-gray-200 space-y-2">
              <Link
                href="/loginpage"
                className="flex items-center justify-center w-full px-4 py-2 text-gray-800 hover:bg-gray-50 hover:text-hospineil-primary rounded-full transition-colors"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Login"
              >
                <FiUser className="w-5 h-5" />
              </Link>
              <Link
                href="/register"
                className="block w-full"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Button className="w-full rounded-full px-4 py-2 bg-hospineil-accent text-hospineil-light-bg hover:bg-hospineil-accent-hover focus:ring-2 focus:ring-hospineil-primary focus:ring-offset-2 transition-all duration-200 border-2 border-hospineil-accent text-sm">Sign up</Button>
              </Link>
              {/* Cart Icon in Mobile Menu - placed after Signup button */}
              <Link
                href="/cart"
                className="flex items-center gap-2 w-full text-left px-4 py-2 text-gray-800 hover:bg-gray-50 hover:text-hospineil-primary rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <FiShoppingCart size={20} />
                <span>Cart</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* No mobile menu dropdown for Login/Register pages - simplified navbar */}
    </nav>
  );
}
