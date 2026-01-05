import { Metadata } from "next";
import { generateMetadata as generateSEO } from "@/lib/seo";

export const metadata: Metadata = generateSEO({
  title: "Privacy Policy - Hospeniel",
  description: "Read Hospeniel's privacy policy to understand how we collect, use, and protect your personal information.",
  keywords: ["privacy policy", "Hospeniel", "data protection", "privacy"],
  url: "/privacy-policy",
  type: "website",
});




