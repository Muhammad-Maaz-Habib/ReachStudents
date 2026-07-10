"use client";

import { useEffect } from "react";

export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("[pwa] service worker registration failed", error);
    });
  }, []);

  return null;
}
