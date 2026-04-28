"use client";

import { useEffect, useRef } from "react";
import { importGoogleMapsLibraries } from "@/lib/googleMaps/loadGoogleMapsScript";
import { cn } from "@/lib/utils";

/** Default map center (Yenagoa, Bayelsa) — visual only; not used for pricing. */
export const CHECKOUT_MAP_DEFAULT_CENTER = { lat: 4.9267, lng: 6.2676 };

interface CheckoutMapPreviewProps {
  /** Selected place coordinates; when null, map stays centered on default with no marker. */
  selected: { lat: number; lng: number } | null;
  className?: string;
}

/**
 * Small read-only map for checkout address confirmation.
 * Must not be wired into delivery fee or zone logic.
 */
export function CheckoutMapPreview({ selected, className }: CheckoutMapPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;

    (async () => {
      try {
        const { maps, marker } = await importGoogleMapsLibraries();
        if (cancelled || !containerRef.current) return;

        const map = new maps.Map(containerRef.current, {
          center: CHECKOUT_MAP_DEFAULT_CENTER,
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          mapId: "DEMO_MAP_ID",
        });
        mapRef.current = map;

        const markerInstance = new marker.AdvancedMarkerElement({
          map,
        });
        markerInstance.map = null;
        markerRef.current = markerInstance;

        const initial = selectedRef.current;
        if (initial) {
          map.setCenter(initial);
          markerInstance.position = initial;
          markerInstance.map = map;
        }
      } catch (err) {
        console.error("[checkout] Map preview failed:", err);
      }
    })();

    return () => {
      cancelled = true;
      markerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    if (selected) {
      map.setCenter(selected);
      marker.position = selected;
      marker.map = map;
    } else {
      map.setCenter(CHECKOUT_MAP_DEFAULT_CENTER);
      marker.map = null;
    }
  }, [selected]);

  return (
    <div
      ref={containerRef}
      className={cn("mt-2 w-full rounded-md border border-gray-200 bg-gray-100", className)}
      style={{ height: 180 }}
      aria-hidden
    />
  );
}
