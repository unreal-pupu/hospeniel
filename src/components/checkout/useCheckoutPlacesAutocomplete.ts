"use client";

import { useEffect, useRef } from "react";
import { importGoogleMapsLibraries } from "@/lib/googleMaps/loadGoogleMapsScript";

interface PlaceAutocompleteCtor {
  new (): google.maps.places.PlaceAutocompleteElement;
}

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
    let autocompleteElement: google.maps.places.PlaceAutocompleteElement | null = null;
    let listener: ((event: Event) => void) | null = null;

    (async () => {
      try {
        await importGoogleMapsLibraries();
        if (cancelled) return;

        const input = document.getElementById(inputId) as HTMLInputElement | null;
        if (!input) return;

        const host = document.createElement("div");
        host.style.display = "none";
        input.parentElement?.appendChild(host);

        const placesNamespace = (window.google.maps.places as unknown as {
          PlaceAutocompleteElement?: PlaceAutocompleteCtor;
        });
        const AutocompleteElement = placesNamespace.PlaceAutocompleteElement;
        if (!AutocompleteElement) return;

        autocompleteElement = new AutocompleteElement();
        host.appendChild(autocompleteElement);

        listener = async (event: Event) => {
          const placeEvent = event as CustomEvent<{ placePrediction?: { toPlace?: () => google.maps.places.Place } }>;
          const prediction = placeEvent.detail?.placePrediction;
          if (!prediction?.toPlace) return;
          const place = prediction.toPlace();
          await place.fetchFields({
            fields: ["formattedAddress", "location"],
          });
          const formatted = place.formattedAddress;
          const lat = place.location?.lat();
          const lng = place.location?.lng();
          if (!formatted || lat == null || lng == null) return;
          input.value = formatted;
          onPlaceSelectedRef.current({
            formatted_address: formatted,
            lat,
            lng,
          });
        };
        autocompleteElement.addEventListener("gmp-select", listener);
      } catch (err) {
        console.error("[checkout] Places autocomplete failed:", err);
      }
    })();

    return () => {
      cancelled = true;
      if (autocompleteElement && listener) {
        autocompleteElement.removeEventListener("gmp-select", listener);
      }
      if (autocompleteElement?.parentElement) {
        autocompleteElement.parentElement.remove();
      }
    };
  }, [enabled, inputId]);
}
