import { Metadata } from "next";
import { generateMetadata as generateSEO } from "@/lib/seo";

export const metadata: Metadata = generateSEO({
  title: "Food Vendors - Order from Local Food Vendors",
  description: "Browse and order from local food vendors on Hospeniel. Discover delicious food from local vendors, view menus, and place orders online.",
  keywords: ["food vendors", "local food", "food delivery", "online ordering", "Hospeniel"],
  url: "/food-vendors",
  type: "website",
});




