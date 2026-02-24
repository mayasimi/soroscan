import { useQuery, useMutation, type QueryHookOptions, type MutationHookOptions } from '@apollo/client';
import type { DocumentNode } from 'graphql';
import type { OperationVariables } from '@apollo/client';

/**
 * Custom hook wrapper for Apollo useQuery with error handling
 */
export function useGraphQLQuery<TData = unknown, TVariables extends OperationVariables = OperationVariables>(
  query: DocumentNode,
  options?: QueryHookOptions<TData, TVariables>
) {
  const result = useQuery<TData, TVariables>(query, {
    ...options,
    onError: (error) => {
      console.error('GraphQL Query Error:', error.message);
      options?.onError?.(error);
    },
  });

  return {
    ...result,
    isLoading: result.loading,
    isError: !!result.error,
  };
}

/**
 * Custom hook wrapper for Apollo useMutation with error handling
 */
export function useGraphQLMutation<TData = unknown, TVariables extends OperationVariables = OperationVariables>(
  mutation: DocumentNode,
  options?: MutationHookOptions<TData, TVariables>
) {
  const [mutate, result] = useMutation<TData, TVariables>(mutation, {
    ...options,
    onError: (error) => {
      console.error('GraphQL Mutation Error:', error.message);
      options?.onError?.(error);
    },
  });

  return [
    mutate,
    {
      ...result,
      isLoading: result.loading,
      isError: !!result.error,
    },
  ] as const;
}
