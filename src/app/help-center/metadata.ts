import { Metadata } from "next";
import { generateMetadata as generateSEO } from "@/lib/seo";

export const metadata: Metadata = generateSEO({
  title: "Help Center - Get Help with Hospeniel",
  description: "Get help with Hospeniel. Find answers to common questions, learn how to use the platform, and contact support.",
  keywords: ["help", "support", "FAQ", "Hospeniel", "customer service"],
  url: "/help-center",
  type: "website",
});




