import { Metadata } from "next";
import { generateMetadata as generateSEO } from "@/lib/seo";

const baseMetadata = generateSEO({
  title: "Register - Create Your Hospeniel Account",
  description: "Create your Hospeniel account to browse vendors, place orders, and enjoy delicious food from local vendors, chefs, and bakers.",
  keywords: ["register", "sign up", "create account", "Hospeniel"],
  url: "/register",
  type: "website",
});

export const metadata: Metadata = {
  ...baseMetadata,
  robots: {
    index: false,
    follow: false,
  },
};




