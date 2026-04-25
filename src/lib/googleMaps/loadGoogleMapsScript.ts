let loadPromise: Promise<void> | null = null;

/** Default map center (Yenagoa, Bayelsa) — UI / preview only; not used for pricing. */
export const YENAGOA_DEFAULT_CENTER = { lat: 4.9267, lng: 6.2676 } as const;

function isGoogleMapsPlacesReady(): boolean {
  if (typeof window === "undefined") return false;
  const g = window as unknown as {
    google?: { maps?: { places?: { Autocomplete?: unknown } } };
  };
  return Boolean(g.google?.maps?.places?.Autocomplete);
}

function waitForGoogleMapsPlacesReady(maxMs: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tick() {
      if (isGoogleMapsPlacesReady()) {
        resolve();
        return;
      }
      if (Date.now() - start > maxMs) {
        reject(
          new Error(
            `${LOG_PREFIX} Timed out after ${maxMs}ms — window.google.maps.places never became available`,
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
 * Loads the Google Maps JavaScript API once (with Places) for client-side use.
 * Key must be set in NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
 *
 * Uses `libraries=places` and, with `loading=async`, a `callback` so the API is
 * ready when the promise resolves (onload alone is not enough).
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

  if (isGoogleMapsPlacesReady()) {
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
      if (isGoogleMapsPlacesReady()) {
        settleOk();
        return;
      }
      function waitUntilReady() {
        void waitForGoogleMapsPlacesReady(30_000).then(settleOk).catch(settleFail);
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

    const cbName = `__hospineilGmaps_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const w = window as unknown as Record<string, (() => void) | undefined>;
    w[cbName] = () => {
      try {
        delete w[cbName];
        void waitForGoogleMapsPlacesReady(15_000).then(settleOk).catch(settleFail);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        settleFail(err);
      }
    };

    const script = document.createElement("script");
    script.dataset.hospineilGoogleMaps = "1";
    script.async = true;
    const params = new URLSearchParams({
      key: apiKey,
      libraries: "places",
      loading: "async",
      callback: cbName,
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;

    script.onload = () => {
      void waitForGoogleMapsPlacesReady(25_000)
        .then(settleOk)
        .catch((e) => {
          const err = e instanceof Error ? e : new Error(String(e));
          settleFail(err);
        });
    };

    script.onerror = () => {
      delete w[cbName];
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
