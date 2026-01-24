import { MetadataRoute } from "next";
import { getSupabaseAdminClient } from "@/lib/supabase";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabaseAdmin = getSupabaseAdminClient();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.hospeniel.com";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/explore`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/vendor-listing`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/food-vendors`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/cakes`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/pastries`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/hire-a-chef`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/help-center`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // Fetch vendors for dynamic pages
  try {
    const { data: vendors, error } = await supabaseAdmin
      .from("vendors")
      .select("id, business_name, name, updated_at")
      .eq("role", "vendor")
      .limit(1000); // Limit to 1000 vendors for sitemap

    if (!error && vendors) {
      const vendorPages: MetadataRoute.Sitemap = vendors.map((vendor) => ({
        url: `${baseUrl}/vendors/${vendor.id}`,
        lastModified: vendor.updated_at ? new Date(vendor.updated_at) : new Date(),
        changeFrequency: "weekly",
        priority: 0.6,
      }));

      return [...staticPages, ...vendorPages];
    }
  } catch (error) {
    console.error("Error generating sitemap:", error);
  }

  return staticPages;
}




