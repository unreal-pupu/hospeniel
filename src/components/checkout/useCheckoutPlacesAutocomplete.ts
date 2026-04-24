"use client";

import { useEffect, useRef } from "react";
import { loadGoogleMapsScript } from "@/lib/googleMaps/loadGoogleMapsScript";

export interface CheckoutPlaceSelection {
  formatted_address: string;
  lat: number;
  lng: number;
}

interface UseCheckoutPlacesAutocompleteOptions {
  inputId: string;
  enabled: boolean;
  onPlaceSelected: (place: CheckoutPlaceSelection) => void;
}

/**
 * Binds Google Places Autocomplete to an existing address input by id.
 * Does not replace the input or affect pricing / zone logic.
 */
export function useCheckoutPlacesAutocomplete({
  inputId,
  enabled,
  onPlaceSelected,
}: UseCheckoutPlacesAutocompleteOptions) {
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  onPlaceSelectedRef.current = onPlaceSelected;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let listener: google.maps.MapsEventListener | undefined;

    (async () => {
      try {
        await loadGoogleMapsScript();
        if (cancelled) return;

        const input = document.getElementById(inputId) as HTMLInputElement | null;
        if (!input) return;

        const autocomplete = new google.maps.places.Autocomplete(input, {
          fields: ["formatted_address", "geometry"],
        });

        listener = autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const loc = place.geometry?.location;
          const formatted = place.formatted_address;
          if (!formatted || !loc) return;
          onPlaceSelectedRef.current({
            formatted_address: formatted,
            lat: loc.lat(),
            lng: loc.lng(),
          });
        });
      } catch (err) {
        console.error("[checkout] Places autocomplete failed:", err);
      }
    })();

    return () => {
      cancelled = true;
      if (listener) {
        google.maps.event.removeListener(listener);
      }
    };
  }, [enabled, inputId]);
}
