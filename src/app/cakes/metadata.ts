import { Metadata } from "next";
import { generateMetadata as generateSEO } from "@/lib/seo";

export const metadata: Metadata = generateSEO({
  title: "Cakes - Order Custom Cakes from Local Bakers",
  description: "Order custom cakes from local bakers on Hospeniel. Browse cake designs, place orders, and enjoy delicious custom cakes for any occasion.",
  keywords: ["cakes", "custom cakes", "bakers", "cake delivery", "birthday cakes", "Hospeniel"],
  url: "/cakes",
  type: "website",
});




