/**
 * Dynamic Metadata for Vendor Pages
 * 
 * This will be used to generate metadata based on vendor data
 */

import { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { getVendorPageMetadata } from "@/lib/seo";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  try {
    const vendorId = params.id;
    
    // Try parsing as number first (legacy), then as UUID
    const isNumeric = !isNaN(Number(vendorId));
    const vendorIdFilter = isNumeric ? Number(vendorId) : vendorId;

    // Fetch vendor data
    const { data: vendor, error } = await supabaseAdmin
      .from("vendors")
      .select(`
        id,
        business_name,
        name,
        description,
        image_url,
        location,
        category,
        profile_id,
        address
      `)
      .eq("id", vendorIdFilter)
      .single();

    if (error || !vendor) {
      // Return default metadata if vendor not found
      return {
        title: "Vendor Not Found",
        description: "The requested vendor could not be found.",
        robots: {
          index: false,
          follow: false,
        },
      };
    }

    // If vendor has profile_id, fetch profile data for additional info
    let profileData = null;
    if (vendor.profile_id) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("name, location, category")
        .eq("id", vendor.profile_id)
        .single();
      profileData = profile;
    }

    // Merge vendor data with profile data
    const vendorData = {
      name: vendor.business_name || vendor.name || profileData?.name,
      business_name: vendor.business_name || vendor.name,
      description: vendor.description || `Food vendor ${vendor.business_name || vendor.name} on Hospeniel`,
      image_url: vendor.image_url || null,
      location: vendor.location || profileData?.location || null,
      category: vendor.category || profileData?.category || null,
      address: vendor.address || null,
      id: vendor.id, // Include vendor ID for URL generation
    };

    return getVendorPageMetadata(vendorData);
  } catch (error) {
    console.error("Error generating vendor metadata:", error);
    // Return default metadata on error
    return {
      title: "Vendor | Hospeniel",
      description: "Browse vendor profile on Hospeniel",
      robots: {
        index: false,
        follow: false,
      },
    };
  }
}

