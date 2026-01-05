import { Metadata } from "next";
import { getExplorePageMetadata } from "@/lib/seo";

// Default metadata for explore page
// Dynamic metadata based on filters will be handled client-side via SEOHead component
export const metadata: Metadata = getExplorePageMetadata();

export default function ExploreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
