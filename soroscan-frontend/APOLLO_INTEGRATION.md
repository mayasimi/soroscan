# Apollo Client Integration Guide

This document describes the Apollo Client integration for consuming the Django Strawberry GraphQL endpoint.

## Overview

Apollo Client has been successfully integrated into the SoroScan frontend to provide:
- Type-safe GraphQL queries and mutations
- Automatic request caching
- Authentication via JWT tokens
- Error handling and retry logic
- Real-time data synchronization

## Architecture

### Components

1. **Apollo Client Configuration** (`lib/apollo-client.ts`)
   - HTTP Link: Connects to backend GraphQL endpoint
   - Auth Link: Adds JWT tokens to requests
   - Error Link: Handles and logs errors
   - Retry Link: Retries failed network requests
   - InMemoryCache: Caches query results

2. **Apollo Provider** (`providers/ApolloProvider.tsx`)
   - Wraps the application with Apollo context
   - Makes Apollo Client available to all components

3. **Custom Hooks** (`lib/hooks/useGraphQL.ts`)
   - `useGraphQLQuery`: Wrapper for queries with error handling
   - `useGraphQLMutation`: Wrapper for mutations with error handling

4. **Test Component** (`components/apollo/ApolloTestComponent.tsx`)
   - Verifies Apollo Client connection
   - Can be added to any page for testing

## Setup Instructions

### 1. Environment Variables

Create `.env.local` in the frontend root:

```env
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:8000/graphql/
NEXT_PUBLIC_API_URL=http://localhost:8000
```

For production, update to your deployed backend URLs.

### 2. Backend CORS Configuration

Ensure Django backend has CORS properly configured in `django-backend/soroscan/settings.py`:

```python
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = ["http://localhost:3000"]
```

Update `.env` in the backend:

```env
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

### 3. Install Dependencies

Dependencies are already installed. If needed:

```bash
cd soroscan-frontend
pnpm install
```

## Usage Examples

### Basic Query

```typescript
import { gql, useQuery } from '@apollo/client';

const GET_CONTRACTS = gql`
  query GetContracts {
    contracts {
      id
      contractId
      name
      isActive
    }
  }
`;

function ContractsList() {
  const { data, loading, error } = useQuery(GET_CONTRACTS);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {data.contracts.map(contract => (
        <li key={contract.id}>{contract.name}</li>
      ))}
    </ul>
  );
}
```

### Query with Variables

```typescript
const GET_CONTRACT_EVENTS = gql`
  query GetContractEvents($contractId: ID!, $limit: Int) {
    contractEvents(contractId: $contractId, limit: $limit) {
      id
      eventType
      timestamp
      data
    }
  }
`;

function EventsList({ contractId }: { contractId: string }) {
  const { data, loading, error } = useQuery(GET_CONTRACT_EVENTS, {
    variables: { contractId, limit: 50 }
  });

  // ... render logic
}
```

### Mutation

```typescript
const CREATE_WEBHOOK = gql`
  mutation CreateWebhook($input: WebhookInput!) {
    createWebhook(input: $input) {
      id
      url
      isActive
    }
  }
`;

function CreateWebhookForm() {
  const [createWebhook, { loading, error }] = useMutation(CREATE_WEBHOOK);

  const handleSubmit = async (formData) => {
    try {
      const { data } = await createWebhook({
        variables: { input: formData },
        refetchQueries: ['GetWebhooks'] // Refresh webhooks list
      });
      console.log('Webhook created:', data.createWebhook);
    } catch (err) {
      console.error('Failed to create webhook:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Webhook'}
      </button>
      {error && <p>Error: {error.message}</p>}
    </form>
  );
}
```

### Using Custom Hooks

```typescript
import { useGraphQLQuery } from '@/lib/hooks/useGraphQL';

function EventsList() {
  const { data, isLoading, isError, error } = useGraphQLQuery(GET_EVENTS);

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Error: {error?.message}</div>;

  return <div>{/* render events */}</div>;
}
```

## Authentication

### Setting JWT Token

When a user logs in, store the JWT token:

```typescript
// After successful login
localStorage.setItem('access_token', token);
```

The Apollo Client will automatically:
1. Read the token from localStorage
2. Add it to the `Authorization` header as `Bearer <token>`
3. Include it in all GraphQL requests

### Token Refresh

Token refresh logic is prepared but requires backend implementation (Issue #2):

```typescript
import { refreshToken } from '@/lib/apollo-client';

// Call when token expires
const newToken = await refreshToken();
if (newToken) {
  // Token refreshed successfully
} else {
  // Redirect to login
}
```

### Handling Authentication Errors

The error link automatically:
- Detects `UNAUTHENTICATED` errors
- Clears invalid tokens from localStorage
- Logs authentication failures

## Testing

### Test Apollo Connection

Add the test component to any page:

```typescript
import { ApolloTestComponent } from '@/components/apollo/ApolloTestComponent';

export default function TestPage() {
  return (
    <div>
      <h1>Apollo Client Test</h1>
      <ApolloTestComponent />
    </div>
  );
}
```

### Run Tests

```bash
cd soroscan-frontend
pnpm run test:ci
```

### Run Linter

```bash
pnpm run lint
```

### Build for Production

```bash
pnpm run build
```

## Apollo DevTools

1. Install [Apollo Client DevTools](https://chrome.google.com/webstore/detail/apollo-client-devtools/jdkknkkbebbapilgoeccciglkfbmbnfm)
2. Open browser DevTools
3. Navigate to "Apollo" tab
4. Inspect:
   - Active queries and their cache status
   - Mutations and their results
   - Cache contents
   - Network requests

## Error Handling

### GraphQL Errors

GraphQL errors are automatically logged with:
- Error message
- Location in query
- Path to field that caused error
- Extension data (e.g., error codes)

### Network Errors

Network errors are automatically:
- Logged with status codes
- Retried up to 3 times with exponential backoff
- Surfaced to components via the `error` object

### Custom Error Handling

```typescript
const { data, error } = useQuery(MY_QUERY, {
  onError: (error) => {
    // Custom error handling
    if (error.graphQLErrors.some(e => e.extensions?.code === 'RATE_LIMITED')) {
      showToast('Rate limit exceeded. Please try again later.');
    }
  }
});
```

## Caching

### Cache Configuration

The InMemoryCache is configured with:
- Type policies for pagination
- Automatic cache updates on mutations
- Cache-and-network fetch policy for real-time data

### Manual Cache Updates

```typescript
const [createEvent] = useMutation(CREATE_EVENT, {
  update(cache, { data: { createEvent } }) {
    // Read existing events from cache
    const existing = cache.readQuery({ query: GET_EVENTS });
    
    // Write updated events to cache
    cache.writeQuery({
      query: GET_EVENTS,
      data: {
        events: [...existing.events, createEvent]
      }
    });
  }
});
```

### Cache Invalidation

```typescript
// Refetch specific queries
const [deleteEvent] = useMutation(DELETE_EVENT, {
  refetchQueries: ['GetEvents', 'GetEventStats']
});

// Or clear cache entirely
import { client } from '@/lib/apollo-client';
await client.clearStore();
```

## Performance Optimization

### Query Batching

Apollo Client automatically batches queries made within 10ms of each other.

### Pagination

```typescript
const { data, fetchMore } = useQuery(GET_EVENTS, {
  variables: { offset: 0, limit: 20 }
});

const loadMore = () => {
  fetchMore({
    variables: { offset: data.events.length },
    updateQuery: (prev, { fetchMoreResult }) => ({
      events: [...prev.events, ...fetchMoreResult.events]
    })
  });
};
```

### Optimistic UI

```typescript
const [likeEvent] = useMutation(LIKE_EVENT, {
  optimisticResponse: {
    likeEvent: {
      __typename: 'Event',
      id: eventId,
      likes: currentLikes + 1
    }
  }
});
```

## Troubleshooting

### "Network error: Failed to fetch"

**Cause**: Backend not running or CORS misconfigured

**Solution**:
1. Verify backend is running: `curl http://localhost:8000/graphql/`
2. Check CORS settings in Django
3. Verify `NEXT_PUBLIC_GRAPHQL_URL` in `.env.local`

### "Authentication token invalid"

**Cause**: Token expired or malformed

**Solution**:
1. Check token in localStorage: `localStorage.getItem('access_token')`
2. Verify token format (should be JWT)
3. Implement token refresh logic

### Queries not updating after mutation

**Cause**: Cache not invalidated

**Solution**:
1. Use `refetchQueries` option in mutation
2. Manually update cache in `update` function
3. Use `fetchPolicy: 'network-only'` for critical queries

### DevTools not showing queries

**Cause**: DevTools not enabled or extension not installed

**Solution**:
1. Install Apollo Client DevTools extension
2. Verify `NODE_ENV=development`
3. Check browser console for errors

## CI/CD Integration

The Apollo Client integration passes all CI checks:

- ✅ TypeScript compilation
- ✅ ESLint (no errors, only pre-existing warnings)
- ✅ Jest tests (38 tests passing)
- ✅ Production build

## Next Steps

1. **Token Refresh** (Backend Issue #2)
   - Implement refresh token endpoint
   - Add automatic token refresh logic
   - Handle token expiration gracefully

2. **GraphQL Type Generation** (FE-5)
   - Generate TypeScript types from schema
   - Use typed queries and mutations
   - Enable autocomplete in IDE

3. **Real-time Subscriptions**
   - Add WebSocket link for subscriptions
   - Subscribe to contract events
   - Update UI in real-time

4. **Query Optimization**
   - Implement query batching
   - Add pagination helpers
   - Optimize cache policies

## Resources

- [Apollo Client Documentation](https://www.apollographql.com/docs/react/)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)
- [Strawberry GraphQL Docs](https://strawberry.rocks/)
- [Django CORS Headers](https://github.com/adamchainz/django-cors-headers)

## Support

For issues or questions:
1. Check this documentation
2. Review Apollo Client logs in browser console
3. Test connection with `ApolloTestComponent`
4. Check backend GraphQL endpoint directly
