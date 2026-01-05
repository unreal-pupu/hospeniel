"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";
import BackToTop from "./BackToTop";

export default function NavbarVisibilityWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isVendorPage = pathname?.startsWith("/vendor");
  const isAdminPage = pathname?.startsWith("/admin");

  return (
    <>
      {!isVendorPage && !isAdminPage && <Navbar />}

      <main
        className={`min-h-screen ${
          isVendorPage || isAdminPage ? "p-0" : "pt-24 p-6"
        } ${isVendorPage || isAdminPage ? "bg-gray-50" : "bg-white"}`}
        style={{ 
          overflowX: 'hidden',
          position: 'relative',
          width: '100%'
        }}
      >
        {children}
      </main>

      {!isVendorPage && !isAdminPage && (
        <>
          <BackToTop />
          <Footer />
        </>
      )}
    </>
  );
}
