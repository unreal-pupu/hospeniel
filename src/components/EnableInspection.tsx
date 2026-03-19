"use client";

import { useEffect } from "react";

export default function EnableInspection() {
  useEffect(() => {
    const stopBlockers = (event: Event) => {
      event.stopImmediatePropagation();
    };

    document.addEventListener("contextmenu", stopBlockers, true);
    document.addEventListener("keydown", stopBlockers, true);
    document.addEventListener("selectstart", stopBlockers, true);
    document.addEventListener("copy", stopBlockers, true);
    document.addEventListener("cut", stopBlockers, true);
    document.addEventListener("paste", stopBlockers, true);

    return () => {
      document.removeEventListener("contextmenu", stopBlockers, true);
      document.removeEventListener("keydown", stopBlockers, true);
      document.removeEventListener("selectstart", stopBlockers, true);
      document.removeEventListener("copy", stopBlockers, true);
      document.removeEventListener("cut", stopBlockers, true);
      document.removeEventListener("paste", stopBlockers, true);
    };
  }, []);

  return null;
}
