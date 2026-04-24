const SCRIPT_ID = "hospineil-google-maps-places";

/** Default map center (Yenagoa, Bayelsa). Used for preview only; not used for pricing. */
export const YENAGOA_DEFAULT_CENTER = { lat: 4.9267, lng: 6.2676 } as const;

interface MinimalMapsWindow extends Window {
  google?: {
    maps?: {
      places?: unknown;
    };
  };
}

let loadPromise: Promise<void> | null = null;

function isMapsReady(win: Window): boolean {
  const g = win as MinimalMapsWindow;
  return Boolean(g.google?.maps?.places);
}

/**
 * Loads Google Maps JavaScript API with the Places library once per page.
 * Key must be set in NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (never hardcoded).
 */
export function loadGoogleMapsWithPlaces(): Promise<void> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return Promise.reject(new Error("NO_GOOGLE_MAPS_API_KEY"));
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));

  if (isMapsReady(window)) return Promise.resolve();

  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    function startPoll() {
      let attempts = 0;
      const maxAttempts = 600;
      const poll = () => {
        if (isMapsReady(window)) {
          done();
          return;
        }
        attempts += 1;
        if (attempts >= maxAttempts) {
          fail(new Error("GOOGLE_MAPS_READY_TIMEOUT"));
          return;
        }
        window.requestAnimationFrame(poll);
      };
      poll();
    }

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", startPoll, { once: true });
      existing.addEventListener(
        "error",
        () => fail(new Error("GOOGLE_MAPS_SCRIPT_ERROR")),
        { once: true }
      );
      startPoll();
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&v=weekly`;
    script.addEventListener("load", startPoll, { once: true });
    script.addEventListener(
      "error",
      () => fail(new Error("GOOGLE_MAPS_SCRIPT_ERROR")),
      { once: true }
    );
    document.head.appendChild(script);
  });

  return loadPromise;
}

export function hasGoogleMapsApiKey(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
}
