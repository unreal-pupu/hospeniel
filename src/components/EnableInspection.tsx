"use client";

import { useEffect } from "react";

/** Allow normal typing/selection in form fields — blocking these globally breaks mobile keyboards and inputs. */
function isFormFieldInteraction(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest("input, textarea, select, option, [contenteditable='true']")
  );
}

export default function EnableInspection() {
  useEffect(() => {
    const stopBlockers = (event: Event) => {
      if (isFormFieldInteraction(event.target)) return;
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
