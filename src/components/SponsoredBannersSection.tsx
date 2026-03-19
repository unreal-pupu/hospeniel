"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type SponsoredBanner = {
  id: string;
  vendor_id: string;
  vendor_name: string;
  vendor_image: string | null;
  title: string | null;
  image_url: string;
  link_url: string;
  created_at: string;
};

async function trackEvent(args: {
  bannerId: string;
  vendorId: string;
  eventType: "view" | "click";
}) {
  try {
    await fetch("/api/sponsored-banners/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bannerId: args.bannerId,
        vendorId: args.vendorId,
        eventType: args.eventType,
      }),
      // Best-effort when navigating away
      keepalive: true,
    });
  } catch {
    // Non-blocking
  }
}

export default function SponsoredBannersSection() {
  const [banners, setBanners] = useState<SponsoredBanner[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBanners = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sponsored-banners?t=${Date.now()}`);
      const data = await res.json();
      setBanners((data?.banners || []) as SponsoredBanner[]);
    } catch (e) {
      console.error("SponsoredBannersSection fetch error:", e);
      setBanners([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBanners();
  }, [fetchBanners]);

  useEffect(() => {
    if (banners.length === 0) return;
    // Best-effort: track views once per mount.
    void Promise.all(
      banners.map((b) =>
        trackEvent({ bannerId: b.id, vendorId: b.vendor_id, eventType: "view" })
      )
    );
  }, [banners]);

  if (loading) return null;

  if (banners.length === 0) {
    return (
      <section className="py-10 bg-hospineil-base-bg px-4 sm:px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold font-header text-hospineil-primary mb-4">
            Sponsored
          </h2>
          <div className="text-center py-10 text-gray-600 font-body">
            No active sponsored banners yet.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-10 bg-hospineil-base-bg px-4 sm:px-6 md:px-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold font-header text-hospineil-primary">
              Sponsored Banners
            </h2>
            <p className="text-gray-600 font-body mt-2">
              Promotions from premium vendors in your area.
            </p>
          </div>
          <Button
            variant="outline"
            className="border-hospineil-primary/30 text-hospineil-primary"
            asChild
          >
            <Link href="/explore">Explore vendors</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {banners.map((banner) => (
            <Link
              key={banner.id}
              href={banner.link_url}
              className="block group"
              onClick={() => {
                void trackEvent({
                  bannerId: banner.id,
                  vendorId: banner.vendor_id,
                  eventType: "click",
                });
              }}
            >
              <Card className="overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-sm group-hover:shadow-md transition-shadow">
                <div className="relative w-full h-56 bg-gray-100">
                  <Image
                    src={banner.image_url}
                    alt={banner.title || banner.vendor_name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                </div>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-hospineil-primary" />
                    <span className="text-xs font-semibold text-hospineil-primary uppercase tracking-wide">
                      {banner.vendor_name}
                    </span>
                  </div>
                  <p className="font-header font-semibold text-gray-900 line-clamp-2">
                    {banner.title || "Sponsored promotion"}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

