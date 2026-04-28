"use client";

import { useEffect, useRef } from "react";
import {
  importGoogleMapsLibraries,
  YENAGOA_DEFAULT_CENTER,
  hasGoogleMapsApiKey,
} from "@/lib/googleMaps/loadGoogleMapsScript";

/** Minimal typings for Maps JS API (avoids adding @types/google.maps). */
interface MapsLatLngLiteral {
  lat: number;
  lng: number;
}

interface MapInstance {
  setCenter: (c: MapsLatLngLiteral) => void;
  setZoom: (z: number) => void;
}

interface MarkerInstance {
  map?: MapInstance | null;
  setPosition: (p: MapsLatLngLiteral) => void;
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
  const autocompleteContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const markerRef = useRef<MarkerInstance | null>(null);
  const autocompleteRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);
  const autocompleteListenerRef = useRef<((event: Event) => void) | null>(null);
  const onPlaceResolvedRef = useRef(onPlaceResolved);
  const disabledRef = useRef(disabled);

  onPlaceResolvedRef.current = onPlaceResolved;
  disabledRef.current = disabled;

  useEffect(() => {
    if (!enabled || !hasGoogleMapsApiKey()) return;

    let cancelled = false;

    function initMap(maps: google.maps.MapsLibrary, markerLib: google.maps.MarkerLibrary) {
      const el = mapContainerRef.current;
      if (!el || mapRef.current) return;
      const map = new maps.Map(el, {
        center: { ...YENAGOA_DEFAULT_CENTER },
        zoom: 13,
        disableDefaultUI: true,
        gestureHandling: "cooperative",
        mapId: "DEMO_MAP_ID",
      });
      mapRef.current = map;
      markerRef.current = new markerLib.AdvancedMarkerElement({
        position: { ...YENAGOA_DEFAULT_CENTER },
        map,
      });
    }

    function attachAutocomplete(places: google.maps.PlacesLibrary) {
      const container = autocompleteContainerRef.current;
      const input = document.getElementById(addressInputId);
      if (!container || !input || !(input instanceof HTMLInputElement)) return;

      container.innerHTML = "";

      const autocomplete = new places.PlaceAutocompleteElement();
      autocompleteRef.current = autocomplete;
      autocomplete.setAttribute("requested-language", "en");
      autocomplete.setAttribute("included-region-codes", "ng");

      const listener = async (event: Event) => {
        if (disabledRef.current) return;
        const placeEvent = event as CustomEvent<{ placePrediction?: { toPlace?: () => google.maps.places.Place } }>;
        const placePrediction = placeEvent.detail?.placePrediction;
        if (!placePrediction?.toPlace) return;
        const place = placePrediction.toPlace();
        await place.fetchFields({
          fields: ["displayName", "formattedAddress", "location"],
        });
        const lat = place.location?.lat();
        const lng = place.location?.lng();
        const formatted = place.formattedAddress?.trim();
        if (lat == null || lng == null || !formatted) return;

        input.value = formatted;
        onPlaceResolvedRef.current({ formattedAddress: formatted, lat, lng });

        const map = mapRef.current;
        const marker = markerRef.current;
        if (map && marker) {
          const pos = { lat, lng };
          map.setCenter(pos);
          map.setZoom(16);
          marker.setPosition(pos);
        }
      };

      autocomplete.addEventListener("gmp-select", listener);
      autocompleteListenerRef.current = listener;
      container.appendChild(autocomplete);
    }

    (async () => {
      try {
        console.log("[CheckoutAddressPlacesAssist] Requesting Google Maps script…");
        const { maps, marker, places } = await importGoogleMapsLibraries();
        if (cancelled) return;

        if (!places?.PlaceAutocompleteElement) {
          console.error(
            "[CheckoutAddressPlacesAssist] Script reported ready but PlaceAutocompleteElement is missing.",
          );
          return;
        }

        console.log("[CheckoutAddressPlacesAssist] Initializing map preview and Places Autocomplete");
        initMap(maps, marker);
        attachAutocomplete(places);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          "[CheckoutAddressPlacesAssist] Google Maps failed; address autocomplete disabled. Reason:",
          message,
          err,
        );
      }
    })();

    return () => {
      cancelled = true;
      if (autocompleteRef.current && autocompleteListenerRef.current) {
        autocompleteRef.current.removeEventListener("gmp-select", autocompleteListenerRef.current);
      }
      if (autocompleteContainerRef.current) {
        autocompleteContainerRef.current.innerHTML = "";
      }
      autocompleteRef.current = null;
      autocompleteListenerRef.current = null;
      if (markerRef.current) {
        markerRef.current.map = null;
      }
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
        Type your street address for suggestions. If autocomplete is unavailable, you can still
        continue checkout by entering a nearest landmark manually.
      </p>
      <div
        ref={autocompleteContainerRef}
        className="rounded-md border border-gray-200 bg-white p-2 [&>gmp-place-autocomplete]:w-full"
      />
      <div
        ref={mapContainerRef}
        className="h-40 w-full rounded-md border border-gray-200 bg-gray-100 overflow-hidden"
        aria-hidden
      />
    </div>
  );
}
