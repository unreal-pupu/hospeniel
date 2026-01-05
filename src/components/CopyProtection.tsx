"use client";

import { useEffect } from "react";

export default function CopyProtection() {
  useEffect(() => {
    // Disable right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Disable keyboard shortcuts for copy, cut, paste, select all
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable Ctrl+C, Ctrl+A, Ctrl+X, Ctrl+V, Ctrl+S, Ctrl+P, F12
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "c" || e.key === "C" || 
         e.key === "x" || e.key === "X" || 
         e.key === "v" || e.key === "V" || 
         e.key === "a" || e.key === "A" || 
         e.key === "s" || e.key === "S" || 
         e.key === "p" || e.key === "P" ||
         e.key === "u" || e.key === "U" ||
         e.key === "i" || e.key === "I")
      ) {
        e.preventDefault();
        return false;
      }
      
      // Disable F12 (Developer Tools)
      if (e.key === "F12") {
        e.preventDefault();
        return false;
      }

      // Disable Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (Developer Tools)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key === "I" || e.key === "i" || 
         e.key === "J" || e.key === "j" || 
         e.key === "C" || e.key === "c")
      ) {
        e.preventDefault();
        return false;
      }
    };

    // Disable text selection via mouse drag
    const handleSelectStart = (e: Event) => {
      const target = e.target as HTMLElement;
      // Allow selection in input fields, textareas, and contenteditable elements
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return true;
      }
      e.preventDefault();
      return false;
    };

    // Disable drag and drop
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      // Allow drag in input fields and textareas
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return true;
      }
      e.preventDefault();
      return false;
    };

    // Disable copy event
    const handleCopy = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      // Allow copy in input fields, textareas, and contenteditable elements
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        (target.closest("input") || target.closest("textarea"))
      ) {
        return true;
      }
      e.preventDefault();
      return false;
    };

    // Disable cut event
    const handleCut = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      // Allow cut in input fields, textareas, and contenteditable elements
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        (target.closest("input") || target.closest("textarea"))
      ) {
        return true;
      }
      e.preventDefault();
      return false;
    };

    // Disable paste event (except in input fields)
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      // Allow paste in input fields, textareas, and contenteditable elements
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        (target.closest("input") || target.closest("textarea"))
      ) {
        return true;
      }
      e.preventDefault();
      return false;
    };

    // Disable image dragging
    const handleImageDrag = (e: DragEvent) => {
      if (e.target instanceof HTMLImageElement) {
        e.preventDefault();
        return false;
      }
    };

    // Add event listeners
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("selectstart", handleSelectStart);
    document.addEventListener("dragstart", handleDragStart);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("cut", handleCut);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("dragstart", handleImageDrag);

    // Cleanup
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("selectstart", handleSelectStart);
      document.removeEventListener("dragstart", handleDragStart);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("cut", handleCut);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("dragstart", handleImageDrag);
    };
  }, []);

  return null; // This component doesn't render anything
}




