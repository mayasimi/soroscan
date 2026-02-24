/**
 * Example: Using Generated GraphQL Types
 * 
 * This file demonstrates how to use the auto-generated types from GraphQL Codegen.
 * The types are fully typed with no 'any' types, providing end-to-end type safety.
 */

import type { GetEventsQuery, GetEventsQueryVariables } from '../generated/graphql';

// Example 1: Using query variables with full type safety
const variables: GetEventsQueryVariables = {
  contractId: 'contract-123',
  first: 10,
};

// Example 2: Handling query results with typed data
function handleEventsData(data: GetEventsQuery) {
  // TypeScript knows the exact shape of the data
  data.events.edges.forEach((edge) => {
    const event = edge.node;
    
    // All properties are fully typed
    console.log({
      id: event.id,              // string
      contractId: event.contractId, // string
      eventType: event.eventType,   // string
      data: event.data,             // string
      createdAt: event.createdAt,   // string
    });
  });
}

// Example 3: Type-safe function that processes events
function processEvents(
  events: GetEventsQuery['events']['edges']
): Array<{ id: string; type: string }> {
  return events.map((edge) => ({
    id: edge.node.id,
    type: edge.node.eventType,
  }));
}

export { variables, handleEventsData, processEvents };
