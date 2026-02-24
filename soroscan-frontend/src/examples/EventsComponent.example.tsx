/**
 * Example: Using GraphQL Types in React Components
 * 
 * This demonstrates how to use generated types with fetch or any GraphQL client.
 * For Apollo Client integration, install @apollo/client and use their hooks.
 */

import { useState, useEffect } from 'react';
import type { GetEventsQuery, GetEventsQueryVariables } from '../generated/graphql';

interface EventsComponentProps {
  contractId: string;
}

export function EventsComponent({ contractId }: EventsComponentProps) {
  const [data, setData] = useState<GetEventsQuery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoading(true);
        
        // Type-safe variables
        const variables: GetEventsQueryVariables = {
          contractId,
          first: 10,
        };

        // GraphQL query string (in production, read from .graphql file)
        const query = `
          query GetEvents($contractId: String!, $first: Int!) {
            events(contractId: $contractId, first: $first) {
              edges {
                node {
                  id
                  contractId
                  eventType
                  data
                  createdAt
                }
              }
            }
          }
        `;

        // Example fetch call (replace with your GraphQL client)
        const response = await fetch('http://localhost:8000/graphql/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            variables,
          }),
        });

        const result = await response.json();
        
        // Type-safe data handling
        setData(result.data as GetEventsQuery);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, [contractId]);

  if (loading) return <div>Loading events...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return <div>No data</div>;

  return (
    <div>
      <h2>Events for Contract: {contractId}</h2>
      <ul>
        {data.events.edges.map((edge) => (
          <li key={edge.node.id}>
            <strong>{edge.node.eventType}</strong>
            <p>Created: {edge.node.createdAt}</p>
            <pre>{edge.node.data}</pre>
          </li>
        ))}
      </ul>
    </div>
  );
}
