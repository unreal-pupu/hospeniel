import { Metadata } from "next";
import { generateMetadata as generateSEO } from "@/lib/seo";

const baseMetadata = generateSEO({
  title: "Login - Sign in to Hospeniel",
  description: "Sign in to your Hospeniel account to browse vendors, place orders, and manage your profile.",
  keywords: ["login", "sign in", "Hospeniel", "account"],
  url: "/loginpage",
  type: "website",
});

export const metadata: Metadata = {
  ...baseMetadata,
  robots: {
    index: false,
    follow: false,
  },
};

