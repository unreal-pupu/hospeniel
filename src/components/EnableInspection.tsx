"use client";

import { useEffect } from "react";

/**
 * Allow normal typing/selection and form submission — blocking these globally breaks
 * mobile virtual keyboards, paste, and Enter/Space on submit buttons.
 */
function shouldAllowInteraction(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  // Any control inside a form (inputs, textareas, buttons, submit) must receive events
  if (target.closest("form")) return true;
  return Boolean(
    target.closest(
      "input, textarea, select, option, [contenteditable]:not([contenteditable='false'])"
    )
  );
}

export default function EnableInspection() {
  useEffect(() => {
    const stopBlockers = (event: Event) => {
      if (shouldAllowInteraction(event.target)) return;
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
