"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/context/ToastContext";
import { ApolloProvider } from "@/providers/ApolloProvider";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ApolloProvider>
      <ToastProvider>{children}</ToastProvider>
    </ApolloProvider>
  );
}

