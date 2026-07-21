"use client";

import { SessionProvider } from "next-auth/react";
import { RegisterServiceWorker } from "@/components/pwa/register-service-worker";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <RegisterServiceWorker />
      {children}
      <Toaster richColors position="top-center" />
    </SessionProvider>
  );
}
