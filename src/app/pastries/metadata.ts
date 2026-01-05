import { Metadata } from "next";
import { generateMetadata as generateSEO } from "@/lib/seo";

export const metadata: Metadata = generateSEO({
  title: "Pastries - Order Fresh Pastries from Local Bakers",
  description: "Order fresh pastries from local bakers on Hospeniel. Browse pastries, view menus, and place orders for delicious fresh pastries.",
  keywords: ["pastries", "bakers", "fresh pastries", "pastry delivery", "Hospeniel"],
  url: "/pastries",
  type: "website",
});




