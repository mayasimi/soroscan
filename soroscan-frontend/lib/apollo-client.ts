import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
  ApolloLink,
  from,
} from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';

// HTTP Link - connects to the GraphQL endpoint
const httpLink = new HttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:8000/graphql/',
  credentials: 'include', // Include cookies for session-based auth
});

// Auth Link - adds JWT token to request headers
const authLink = new ApolloLink((operation, forward) => {
  // Only access localStorage on client side
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) {
      operation.setContext(({ headers = {} }) => ({
        headers: {
          ...headers,
          authorization: `Bearer ${token}`,
        },
      }));
    }
  }
  return forward(operation);
});

// Error Link - handles and logs errors
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${JSON.stringify(locations)}, Path: ${path}`
      );
      
      // Handle authentication errors
      if (extensions?.code === 'UNAUTHENTICATED') {
        // Clear invalid token
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
        }
        console.warn('Authentication token invalid or expired');
      }
    });
  }

  if (networkError) {
    console.error(`[Network error]: ${networkError.message}`);
    
    // Log additional network error details
    if ('statusCode' in networkError) {
      console.error(`Status code: ${networkError.statusCode}`);
    }
  }
});

// Retry Link - retries failed requests
const retryLink = new RetryLink({
  delay: {
    initial: 300,
    max: 3000,
    jitter: true,
  },
  attempts: {
    max: 3,
    retryIf: (error) => {
      // Retry on network errors but not on GraphQL errors
      return !!error && !error.message.includes('GraphQL error');
    },
  },
});

// Combine all links
const link = from([errorLink, retryLink, authLink, httpLink]);

// Create Apollo Client instance
export const client = new ApolloClient({
  link,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // Add pagination helpers if needed
          events: {
            keyArgs: ['filters'],
            merge(existing = [], incoming) {
              return [...existing, ...incoming];
            },
          },
        },
      },
    },
  }),
  // Enable Apollo DevTools in development
  devtools: {
    enabled: process.env.NODE_ENV === 'development',
  },
  // Default options for queries
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
});

// Helper function to refresh the token (to be implemented with backend Issue #2)
export const refreshToken = async (): Promise<string | null> => {
  try {
    // This will be implemented when backend token refresh is ready
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/token/refresh/`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.access_token) {
        localStorage.setItem('access_token', data.access_token);
        return data.access_token;
      }
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
  }
  return null;
};
