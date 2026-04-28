let loadPromise: Promise<void> | null = null;
const LOG_PREFIX = "[Hospineil Google Maps]";

/** Default map center (Yenagoa, Bayelsa) — UI / preview only; not used for pricing. */
export const YENAGOA_DEFAULT_CENTER = { lat: 4.9267, lng: 6.2676 } as const;

interface GoogleMapsWindow {
  google?: {
    maps?: {
      importLibrary?: (name: string) => Promise<unknown>;
    };
  };
}

function isGoogleMapsReady(): boolean {
  if (typeof window === "undefined") return false;
  const g = window as unknown as GoogleMapsWindow;
  return Boolean(g.google?.maps?.importLibrary);
}

function waitForGoogleMapsReady(maxMs: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tick() {
      if (isGoogleMapsReady()) {
        resolve();
        return;
      }
      if (Date.now() - start > maxMs) {
        reject(
          new Error(
            `${LOG_PREFIX} Timed out after ${maxMs}ms — window.google.maps.importLibrary never became available`,
          ),
        );
        return;
      }
      window.setTimeout(tick, 50);
    }
    tick();
  });
}

/**
 * Loads the Google Maps JavaScript API once for client-side use.
 * Key must be set in NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
 */
export function loadGoogleMapsScript(): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    const err = new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set");
    return Promise.reject(err);
  }
  if (typeof window === "undefined") {
    const err = new Error("Google Maps can only load in the browser");
    return Promise.reject(err);
  }

  if (isGoogleMapsReady()) {
    return Promise.resolve();
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    let settled = false;

    function settleOk() {
      if (settled) return;
      settled = true;
      resolve();
    }

    function settleFail(err: Error) {
      if (settled) return;
      settled = true;
      loadPromise = null;
      reject(err);
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-hospineil-google-maps="1"]',
    );

    if (existing) {
      if (isGoogleMapsReady()) {
        settleOk();
        return;
      }
      function waitUntilReady() {
        void waitForGoogleMapsReady(30_000).then(settleOk).catch(settleFail);
      }
      existing.addEventListener("load", waitUntilReady, { once: true });
      existing.addEventListener(
        "error",
        () => {
          settleFail(new Error("Google Maps script element fired error"));
        },
        { once: true },
      );
      // load may have already fired (SPA / cached); polling covers that case
      waitUntilReady();
      return;
    }

    const script = document.createElement("script");
    script.dataset.hospineilGoogleMaps = "1";
    script.async = true;
    const params = new URLSearchParams({
      key: apiKey,
      loading: "async",
      v: "weekly",
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;

    script.onload = () => {
      void waitForGoogleMapsReady(25_000)
        .then(settleOk)
        .catch((e) => {
          const err = e instanceof Error ? e : new Error(String(e));
          settleFail(err);
        });
    };

    script.onerror = () => {
      settleFail(
        new Error(
          "Failed to load Google Maps script (network, CSP, or blocked request). Check the browser Network tab.",
        ),
      );
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

export function hasGoogleMapsApiKey(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
}

export async function importGoogleMapsLibraries(): Promise<{
  maps: google.maps.MapsLibrary;
  marker: google.maps.MarkerLibrary;
  places: google.maps.PlacesLibrary;
}> {
  await loadGoogleMapsScript();
  if (typeof window === "undefined" || !window.google?.maps?.importLibrary) {
    throw new Error(`${LOG_PREFIX} google.maps.importLibrary is unavailable after script load`);
  }

  const [maps, marker, places] = await Promise.all([
    window.google.maps.importLibrary("maps") as Promise<google.maps.MapsLibrary>,
    window.google.maps.importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
    window.google.maps.importLibrary("places") as Promise<google.maps.PlacesLibrary>,
  ]);

  return { maps, marker, places };
}
