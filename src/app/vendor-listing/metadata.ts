import { Metadata } from "next";
import { generateMetadata as generateSEO } from "@/lib/seo";

export const metadata: Metadata = generateSEO({
  title: "Vendor Listing - Browse All Food Vendors",
  description: "Browse all food vendors, chefs, and bakers on Hospeniel. Discover local food vendors, hire professional chefs, and order from talented bakers in your area.",
  keywords: ["vendors", "food vendors", "chefs", "bakers", "Hospeniel", "food delivery", "online ordering"],
  url: "/vendor-listing",
  type: "website",
});




