import { Metadata } from "next";
import { generateMetadata as generateSEO } from "@/lib/seo";

export const metadata: Metadata = generateSEO({
  title: "Hire a Chef - Book Professional Chefs for Your Events",
  description: "Hire professional chefs for your events on Hospeniel. Browse chef profiles, view specialties, and book chefs for catering, private dinners, and special occasions.",
  keywords: ["chefs", "hire chef", "private chef", "catering", "event catering", "Hospeniel"],
  url: "/hire-a-chef",
  type: "website",
});




