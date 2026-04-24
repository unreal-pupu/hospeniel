"use client";

import { useEffect, useRef } from "react";
import {
  loadGoogleMapsWithPlaces,
  YENAGOA_DEFAULT_CENTER,
  hasGoogleMapsApiKey,
} from "@/lib/loadGoogleMapsScript";

/** Minimal typings for Maps JS API (avoids adding @types/google.maps). */
interface MapsLatLngLiteral {
  lat: number;
  lng: number;
}

interface PlaceGeometry {
  location?: { lat: () => number; lng: () => number };
}

interface PlaceResult {
  formatted_address?: string;
  geometry?: PlaceGeometry;
}

interface AutocompleteInstance {
  addListener: (eventName: string, handler: () => void) => void;
  getPlace: () => PlaceResult;
}

interface MapInstance {
  setCenter: (c: MapsLatLngLiteral) => void;
  setZoom: (z: number) => void;
}

interface MarkerInstance {
  setMap: (m: MapInstance | null) => void;
  setPosition: (p: MapsLatLngLiteral) => void;
}

interface MapsNamespace {
  places: {
    Autocomplete: new (
      input: HTMLInputElement,
      opts?: { fields?: string[]; types?: string[] }
    ) => AutocompleteInstance;
  };
  Map: new (
    el: HTMLElement,
    opts: {
      center: MapsLatLngLiteral;
      zoom: number;
      disableDefaultUI?: boolean;
      gestureHandling?: string;
    }
  ) => MapInstance;
  Marker: new (opts: { position: MapsLatLngLiteral; map: MapInstance }) => MarkerInstance;
  event: { clearInstanceListeners: (instance: unknown) => void };
}

function getMaps(): MapsNamespace | null {
  if (typeof window === "undefined") return null;
  const g = (
    window as unknown as {
      google?: { maps?: MapsNamespace };
    }
  ).google?.maps;
  return g ?? null;
}

export interface CheckoutAddressPlacesAssistProps {
  /** Must match the address `<Input id={...} />` so Autocomplete can bind to it. */
  addressInputId: string;
  /** When false, Autocomplete is not attached (e.g. profile still loading). */
  enabled: boolean;
  disabled: boolean;
  onPlaceResolved: (payload: {
    formattedAddress: string;
    lat: number;
    lng: number;
  }) => void;
}

/**
 * Google Places Autocomplete on the existing address field + optional map preview.
 * Does not affect zone/landmark pricing — UI and capture only.
 */
export function CheckoutAddressPlacesAssist({
  addressInputId,
  enabled,
  disabled,
  onPlaceResolved,
}: CheckoutAddressPlacesAssistProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const markerRef = useRef<MarkerInstance | null>(null);
  const autocompleteRef = useRef<AutocompleteInstance | null>(null);
  const onPlaceResolvedRef = useRef(onPlaceResolved);
  const disabledRef = useRef(disabled);

  onPlaceResolvedRef.current = onPlaceResolved;
  disabledRef.current = disabled;

  useEffect(() => {
    if (!enabled || !hasGoogleMapsApiKey()) return;

    let cancelled = false;

    function initMap(maps: MapsNamespace) {
      const el = mapContainerRef.current;
      if (!el || mapRef.current) return;
      const map = new maps.Map(el, {
        center: { ...YENAGOA_DEFAULT_CENTER },
        zoom: 13,
        disableDefaultUI: true,
        gestureHandling: "cooperative",
      });
      mapRef.current = map;
      markerRef.current = new maps.Marker({
        position: { ...YENAGOA_DEFAULT_CENTER },
        map,
      });
    }

    function attachAutocomplete(maps: MapsNamespace) {
      const input = document.getElementById(addressInputId);
      if (!input || !(input instanceof HTMLInputElement)) return;

      if (autocompleteRef.current) {
        maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }

      const autocomplete = new maps.places.Autocomplete(input, {
        fields: ["formatted_address", "geometry", "name"],
        types: ["address"],
      });
      autocompleteRef.current = autocomplete;

      autocomplete.addListener("place_changed", () => {
        if (disabledRef.current) return;
        const place = autocomplete.getPlace();
        const loc = place.geometry?.location;
        const formatted = place.formatted_address?.trim();
        if (!loc || formatted === undefined || formatted === "") return;
        const lat = loc.lat();
        const lng = loc.lng();
        onPlaceResolvedRef.current({ formattedAddress: formatted, lat, lng });

        const map = mapRef.current;
        const marker = markerRef.current;
        if (map && marker) {
          const pos = { lat, lng };
          map.setCenter(pos);
          map.setZoom(16);
          marker.setPosition(pos);
        }
      });
    }

    (async () => {
      try {
        await loadGoogleMapsWithPlaces();
        if (cancelled) return;
        const maps = getMaps();
        if (!maps?.places?.Autocomplete) return;
        initMap(maps);
        attachAutocomplete(maps);
      } catch {
        /* missing key or blocked load — checkout still works manually */
      }
    })();

    return () => {
      cancelled = true;
      const maps = getMaps();
      if (maps?.event && autocompleteRef.current) {
        maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
    };
  }, [addressInputId, enabled]);

  if (!hasGoogleMapsApiKey()) {
    return null;
  }

  return (
    <div className="mt-2 space-y-1">
      <p className="text-xs text-gray-500">
        Type your street address for suggestions. Delivery zone and fee still use the landmark you
        choose below.
      </p>
      <div
        ref={mapContainerRef}
        className="h-40 w-full rounded-md border border-gray-200 bg-gray-100 overflow-hidden"
        aria-hidden
      />
    </div>
  );
}
