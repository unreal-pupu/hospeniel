import type { Metadata } from "next";
import "./globals.css";
import NavbarVisibilityWrapper from "@/components/NavbarVisibilityWrapper";
import CopyProtection from "@/components/CopyProtection";
import { CartProvider } from "../app/context/CartContex";
import SupabaseProvider from "../../src/providers/SupabaseProvider"; // ✅ default import

// Fonts are now loaded via CSS @import in globals.css
// This prevents build failures when Google Fonts is unavailable
// The CSS variables --font-poppins and --font-inter are set in globals.css

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.hospeniel.com"),
  title: {
    default: "Hospeniel - Discover Vendors, Chefs & Bakers",
    template: "%s | Hospeniel",
  },
  description: "Hospeniel helps users find and order from food vendors, chefs, and bakers in their area. Discover delicious food from local vendors, hire professional chefs, and order from talented bakers.",
  keywords: ["Hospeniel", "food delivery", "chefs", "bakers", "vendors", "online ordering", "food vendors", "local food", "catering", "restaurant delivery"],
  authors: [{ name: "Hospeniel" }],
  creator: "Hospeniel",
  publisher: "Hospeniel",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.hospeniel.com",
    siteName: "Hospeniel",
    title: "Hospeniel - Discover Vendors, Chefs & Bakers",
    description: "Hospeniel helps users find and order from food vendors, chefs, and bakers in their area.",
    images: [
      {
        url: "/hospineil-sql.jpg",
        width: 1200,
        height: 630,
        alt: "Hospeniel - Discover Vendors, Chefs & Bakers",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hospeniel - Discover Vendors, Chefs & Bakers",
    description: "Hospeniel helps users find and order from food vendors, chefs, and bakers in their area.",
    images: ["/hospineil-sql.jpg"],
    creator: "@hospeniel", // Update with your Twitter handle
    site: "@hospeniel", // Update with your Twitter handle
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add your verification codes
    // google: "your-google-verification-code",
    // yandex: "your-yandex-verification-code",
    // bing: "your-bing-verification-code",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Copy Protection - Disables text selection, right-click, and keyboard shortcuts */}
        <CopyProtection />
        {/* ✅ Supabase wraps everything so session is available globally */}
        <SupabaseProvider>
          <CartProvider>
            <NavbarVisibilityWrapper>{children}</NavbarVisibilityWrapper>
          </CartProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
