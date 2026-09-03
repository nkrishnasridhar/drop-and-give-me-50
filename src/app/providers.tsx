"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { SerwistProvider } from "@serwist/turbopack/react";
import { useState, type ReactNode } from "react";
import { getQueryClient } from "@/lib/query-client";
import { createBrowserTRPCClient } from "@/lib/trpc-client";
import { TRPCProvider } from "@/lib/trpc";

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() => createBrowserTRPCClient());

  return (
    <SerwistProvider swUrl="/serwist/sw.js">
      <QueryClientProvider client={queryClient}>
        <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
          {children}
        </TRPCProvider>
      </QueryClientProvider>
    </SerwistProvider>
  );
}
