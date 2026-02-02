"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  FaFacebookF, 
  FaInstagram, 
  FaWhatsapp, 
  FaTiktok 
} from "react-icons/fa";

export default function Footer() {
  const pathname = usePathname();
  const router = useRouter();

  const scrollToSection = (sectionId: string) => {
    // If not on home page, navigate to home first
    if (pathname !== "/") {
      router.push(`/#${sectionId}`);
      return;
    }

    // If on home page, scroll to section
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

  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 lg:gap-12">
          
          {/* Brand Section */}
          <div className="sm:col-span-2 lg:col-span-1">
            <h2 className="text-2xl sm:text-3xl font-logo font-semibold tracking-tight mb-4">
              <span className="text-hospineil-primary">Hospe</span>
              <span className="italic text-hospineil-accent">niel</span>
            </h2>
            <p className="text-sm sm:text-base text-gray-600 font-body leading-relaxed max-w-sm">
              Discover food vendors and professional chefs for hire, creative bakers and delightful pastry vendors near you.
            </p>
          </div>

          {/* Explore Section */}
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-5 font-header">Explore</h3>
            <ul className="space-y-3 text-sm sm:text-base">
              <li>
                         <Link
  href="/terms-and-conditions"
  className="text-gray-600 hover:text-hospineil-primary font-body transition-colors duration-200 text-left"
>
  Terms and Conditions
</Link>
              </li>
              <li>
                <Link
  href="/AcceptableUsePolicy"
  className="text-gray-600 hover:text-hospineil-primary font-body transition-colors duration-200 text-left"
>
  Acceptable Use Policy
</Link>

              </li>
              <li>
                  <Link
  href="/pricing"
  className="text-gray-600 hover:text-hospineil-primary font-body transition-colors duration-200 text-left"
>
  Pricing
</Link>

              </li>
            </ul>
          </div>

          {/* Support Section */}
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-5 font-header">Support</h3>
            <ul className="space-y-3 text-sm sm:text-base">
              <li>
               <Link
  href="/refund-policy"
  className="text-gray-600 hover:text-hospineil-primary font-body transition-colors duration-200 text-left"
>
  Refund Policy
</Link>
               <Link
  href="/pricing"
  className="text-gray-600 hover:text-hospineil-primary font-body transition-colors duration-200 text-left"
>
  Pricing
</Link>
              </li>
            </ul>
          </div>

          {/* Newsletter Section */}
          <div className="sm:col-span-2 lg:col-span-1">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-5 font-header">Stay Updated</h3>
            <p className="text-sm text-gray-600 mb-4 font-body leading-relaxed">
              Subscribe to our newsletter for updates and exclusive offers.
            </p>
            <form className="flex flex-col sm:flex-row gap-3 sm:gap-2">
              <input
                type="email"
                placeholder="Enter your email"
                className="px-4 py-2.5 sm:px-4 sm:py-2 flex-1 rounded-xl sm:rounded-l-lg sm:rounded-r-none bg-white border-2 border-gray-200 sm:bg-hospineil-light-bg sm:border-0 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-hospineil-primary focus:border-hospineil-primary focus:ring-offset-1 font-body shadow-sm sm:shadow-none"
              />
              <button
                type="submit"
                className="px-5 py-2 sm:px-6 sm:py-2 bg-hospineil-accent text-hospineil-light-bg rounded-xl sm:rounded-l-none sm:rounded-r-lg hover:bg-hospineil-accent-hover transition-all duration-300 hover:scale-105 hover:shadow-lg font-button font-medium text-xs sm:text-base whitespace-nowrap w-full sm:w-auto shadow-md sm:shadow-none border-2 border-hospineil-accent sm:border-0"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 mt-10 sm:mt-12 pt-8 sm:pt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-6">
          <p className="text-sm sm:text-base text-gray-600 font-body text-center sm:text-left">
            © {new Date().getFullYear()} Hospineil. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-4 sm:gap-5 justify-center sm:justify-end text-gray-600 text-lg sm:text-xl">
            {/* Facebook */}
            <Link 
              href="https://www.facebook.com/hospeniel"
              aria-label="Facebook"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#1877F2] transition-all duration-300 hover:scale-110 hover:rotate-3"
            >
              <FaFacebookF />
            </Link>
            {/* Instagram */}
            <Link 
              href="https://www.instagram.com/hospeniel"
              aria-label="Instagram"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#E1306C] transition-all duration-300 hover:scale-110 hover:rotate-3"
            >
              <FaInstagram />
            </Link>
            {/* WhatsApp */}
            <Link 
              href="https://wa.me/2348162813032"
              aria-label="WhatsApp"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#25D366] transition-all duration-300 hover:scale-110 hover:rotate-3"
            >
              <FaWhatsapp />
            </Link>
            {/* X (formerly Twitter) */}
            <Link 
              href="https://x.com/hospeniel"
              aria-label="X"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-black dark:hover:text-white transition-all duration-300 hover:scale-110 hover:rotate-3"
            >
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="currentColor" 
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </Link>
            {/* TikTok */}
            <Link 
              href="https://www.tiktok.com/@hospeniel"
              aria-label="TikTok"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#FE2C55] transition-all duration-300 hover:scale-110 hover:rotate-3"
            >
              <FaTiktok />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
