"use client";

import { gql, useQuery } from '@apollo/client';

// Simple test query - adjust based on your actual GraphQL schema
const TEST_QUERY = gql`
  query TestConnection {
    __typename
  }
`;

/**
 * Test component to verify Apollo Client connection
 * This component can be temporarily added to any page to test the GraphQL connection
 */
export function ApolloTestComponent() {
  const { data, loading, error } = useQuery(TEST_QUERY);

  return (
    <div className="p-4 border border-terminal-green rounded-md bg-terminal-black/50">
      <h3 className="text-lg font-semibold mb-2">Apollo Client Status</h3>
      
      {loading && (
        <p className="text-yellow-500">Connecting to GraphQL endpoint...</p>
      )}
      
      {error && (
        <div className="text-red-500">
          <p className="font-semibold">Connection Error:</p>
          <p className="text-sm">{error.message}</p>
          <p className="text-xs mt-2">
            Check that the backend is running and CORS is configured correctly.
          </p>
        </div>
      )}
      
      {data && (
        <div className="text-terminal-green">
          <p className="font-semibold">✓ Connected Successfully</p>
          <p className="text-sm">GraphQL endpoint is responding</p>
          <pre className="text-xs mt-2 p-2 bg-black/30 rounded">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
