/**
 * SEO Metadata Utility
 * 
 * Provides utilities for generating SEO metadata, Open Graph tags,
 * Twitter cards, and JSON-LD structured data for Hospineil platform.
 */

import { Metadata } from "next";

export interface SEOConfig {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  url?: string;
  type?: "website" | "article" | "profile";
  siteName?: string;
}

const defaultSiteName = "Hospeniel";
const defaultSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://hospineil.com";
const defaultImage = `${defaultSiteUrl}/og-image.jpg`; // You'll need to create this image

/**
 * Get base URL for the application
 */
export function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return defaultSiteUrl;
}

/**
 * Generate complete metadata object for Next.js
 */
export function generateMetadata(config: SEOConfig): Metadata {
  const {
    title,
    description,
    keywords = [],
    image = defaultImage,
    url,
    type = "website",
    siteName = defaultSiteName,
  } = config;

  // Don't add site name if it's already in the title or if title ends with site name
  const fullTitle = title.includes(siteName) || title.endsWith(`| ${siteName}`) 
    ? title 
    : `${title} | ${siteName}`;
  const fullUrl = url ? (url.startsWith("http") ? url : `${getBaseUrl()}${url}`) : getBaseUrl();
  const fullImage = image.startsWith("http") ? image : `${getBaseUrl()}${image}`;

  return {
    title: fullTitle,
    description,
    keywords: keywords.length > 0 ? keywords.join(", ") : undefined,
    openGraph: {
      title: fullTitle,
      description,
      url: fullUrl,
      siteName,
      images: [
        {
          url: fullImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: "en_US",
      type,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [fullImage],
      creator: "@hospeniel", // Update with your Twitter handle
      site: "@hospeniel", // Update with your Twitter handle
    },
    alternates: {
      canonical: fullUrl,
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
  };
}

/**
 * Generate metadata for landing page
 */
export function getLandingPageMetadata(): Metadata {
  return generateMetadata({
    title: "Hospeniel - Discover Vendors, Chefs & Bakers",
    description: "Hospeniel helps users find and order from food vendors, chefs, and bakers in their area. Discover delicious food from local vendors, hire professional chefs, and order from talented bakers.",
    keywords: [
      "Hospeniel",
      "food delivery",
      "chefs",
      "bakers",
      "vendors",
      "online ordering",
      "food vendors",
      "local food",
      "catering",
      "restaurant delivery",
    ],
    url: "/",
    type: "website",
  });
}

/**
 * Generate metadata for explore page
 */
export function getExplorePageMetadata(
  location?: string,
  category?: string
): Metadata {
  let title = "Explore Food Vendors, Chefs & Bakers";
  let description = "Browse and discover food vendors, chefs, and bakers in your area. Order delicious food from local vendors or hire professional chefs for your events.";

  if (location && location !== "All Locations") {
    title = `Food Vendors in ${location} | Hospeniel`;
    description = `Discover food vendors, chefs, and bakers in ${location}. Browse menus, place orders, and enjoy delicious local food.`;
  }

  if (category && category !== "All") {
    const categoryLabel = getCategoryLabel(category);
    title = `${categoryLabel}s | Hospeniel`;
    description = `Find ${categoryLabel.toLowerCase()}s in your area. Browse menus, place orders, and enjoy delicious food from local ${categoryLabel.toLowerCase()}s.`;
  }

  if (location && location !== "All Locations" && category && category !== "All") {
    const categoryLabel = getCategoryLabel(category);
    title = `${categoryLabel}s in ${location} | Hospeniel`;
    description = `Find ${categoryLabel.toLowerCase()}s in ${location}. Browse menus, place orders, and enjoy delicious food from local ${categoryLabel.toLowerCase()}s.`;
  }

  return generateMetadata({
    title,
    description,
    keywords: [
      "food vendors",
      "chefs",
      "bakers",
      location && location !== "All Locations" ? location : undefined,
      category && category !== "All" ? getCategoryLabel(category) : undefined,
      "online ordering",
      "food delivery",
    ].filter(Boolean) as string[],
    url: "/explore",
    type: "website",
  });
}

/**
 * Generate metadata for vendor page
 */
export function getVendorPageMetadata(vendor: {
  name?: string;
  business_name?: string;
  description?: string;
  image_url?: string;
  location?: string;
  category?: string;
  id?: string | number;
}): Metadata {
  const vendorName = vendor.business_name || vendor.name || "Vendor";
  const description = vendor.description
    ? vendor.description.length > 155
      ? `${vendor.description.substring(0, 155)}...`
      : vendor.description
    : `Order from ${vendorName} on Hospeniel. Browse menu items and place orders from this local food vendor.`;
  const location = vendor.location ? ` in ${vendor.location}` : "";
  const category = vendor.category ? getCategoryLabel(vendor.category) : "Food Vendor";
  const vendorId = vendor.id || vendor.name || vendor.business_name;
  const vendorImage = vendor.image_url
    ? (vendor.image_url.startsWith("http") ? vendor.image_url : `${getBaseUrl()}${vendor.image_url}`)
    : defaultImage;

  return generateMetadata({
    title: `${vendorName} - ${category}${location}`,
    description,
    keywords: [
      vendorName,
      category,
      vendor.location,
      "food vendor",
      "online ordering",
      "food delivery",
      "Hospeniel",
    ].filter(Boolean) as string[],
    image: vendorImage,
    url: `/vendors/${vendorId}`,
    type: "profile",
  });
}

/**
 * Get category label from value
 */
function getCategoryLabel(value: string): string {
  const categories: Record<string, string> = {
    food_vendor: "Food Vendor",
    chef: "Chef",
    baker: "Baker",
    finger_chop: "Finger Chop",
  };
  return categories[value] || value;
}

/**
 * Generate JSON-LD structured data for organization
 */
export function generateOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Hospeniel",
    url: getBaseUrl(),
    logo: `${getBaseUrl()}/logo.png`,
    description: "Hospeniel helps users find and order from food vendors, chefs, and bakers in their area.",
    sameAs: [
      // Add your social media profiles
      // "https://facebook.com/hospineil",
      // "https://twitter.com/hospineil",
      // "https://instagram.com/hospineil",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "Customer Service",
      // Add your contact information
    },
  };
}

/**
 * Generate JSON-LD structured data for website
 */
export function generateWebsiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Hospeniel",
    url: getBaseUrl(),
    description: "Hospeniel helps users find and order from food vendors, chefs, and bakers in their area.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${getBaseUrl()}/explore?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Generate JSON-LD structured data for food establishment (vendor)
 */
export function generateVendorSchema(vendor: {
  name?: string;
  business_name?: string;
  description?: string;
  image_url?: string;
  location?: string;
  category?: string;
  address?: string;
}) {
  const vendorName = vendor.business_name || vendor.name || "Vendor";
  const category = vendor.category || "FoodVendor";
  
  return {
    "@context": "https://schema.org",
    "@type": category === "chef" ? "Person" : "FoodEstablishment",
    name: vendorName,
    description: vendor.description || `Food vendor ${vendorName} on Hospeniel`,
    image: vendor.image_url || defaultImage,
    address: vendor.address
      ? {
          "@type": "PostalAddress",
          addressLocality: vendor.location,
          addressCountry: "NG",
        }
      : undefined,
    servesCuisine: category,
    url: `${getBaseUrl()}/vendors/${vendor.name || vendor.business_name}`,
  };
}

/**
 * Generate JSON-LD structured data for breadcrumb
 */
export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${getBaseUrl()}${item.url}`,
    })),
  };
}

