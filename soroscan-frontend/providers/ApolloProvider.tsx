"use client";

import { ApolloProvider as ApolloProviderBase } from '@apollo/client';
import { client } from '@/lib/apollo-client';
import type { ReactNode } from 'react';

interface ApolloProviderProps {
  children: ReactNode;
}

/**
 * Apollo Provider wrapper for the application.
 * Provides Apollo Client context to all child components.
 */
export function ApolloProvider({ children }: ApolloProviderProps) {
  return <ApolloProviderBase client={client}>{children}</ApolloProviderBase>;
}
