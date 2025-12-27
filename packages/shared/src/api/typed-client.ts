/**
 * Typed API Client
 *
 * Provides tRPC-like end-to-end type safety for API calls.
 * Uses the contracts to ensure compile-time type checking.
 *
 * Usage:
 * ```typescript
 * const client = createTypedClient(fetchFn);
 *
 * // Fully typed - request and response
 * const bots = await client.call('bots.list');
 * // bots is typed as { bots: Bot[], total: number }
 *
 * // With request body
 * const newBot = await client.call('bots.create', {
 *   body: { name: 'MyBot', slug: 'mybot' }
 * });
 *
 * // With path parameters
 * const bot = await client.call('bots.get', { params: { id: '123' } });
 * ```
 */

import { z } from 'zod';
import { apiContracts, type ContractName, type ContractRequest, type ContractResponse, type ContractParams } from './contracts.js';

// ============================================================================
// Types
// ============================================================================

/** Base fetch function type that clients must implement */
export type BaseFetch = <T>(url: string, options?: RequestInit) => Promise<T>;

/** Options for API calls */
export interface CallOptions<T extends ContractName> {
  /** Path parameters (for dynamic routes like /bots/:id) */
  params?: ContractParams<T>;
  /** Request body (for POST/PATCH/PUT) */
  body?: ContractRequest<T>;
  /** Query parameters */
  query?: Record<string, string | number | boolean | undefined>;
  /** Additional fetch options */
  fetchOptions?: RequestInit;
}

/** API Error with typed structure */
export class TypedApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly validationErrors?: z.ZodIssue[]
  ) {
    super(message);
    this.name = 'TypedApiError';
  }
}

// ============================================================================
// Typed Client Factory
// ============================================================================

export interface TypedApiClient {
  /**
   * Make a type-safe API call
   * @param contract - The contract name (e.g., 'bots.list', 'bots.create')
   * @param options - Call options including params, body, and query
   * @returns Typed response based on the contract
   */
  call<T extends ContractName>(
    contract: T,
    options?: CallOptions<T>
  ): Promise<ContractResponse<T>>;

  /**
   * Validate request data against a contract's schema
   */
  validateRequest<T extends ContractName>(
    contract: T,
    data: unknown
  ): ContractRequest<T>;

  /**
   * Validate response data against a contract's schema
   */
  validateResponse<T extends ContractName>(
    contract: T,
    data: unknown
  ): ContractResponse<T>;
}

/**
 * Create a typed API client
 *
 * @param fetchFn - Base fetch function (handles auth, headers, etc.)
 * @param options - Client options
 */
export function createTypedClient(
  fetchFn: BaseFetch,
  options?: {
    /** Validate responses in development */
    validateResponses?: boolean;
    /** Validate requests before sending */
    validateRequests?: boolean;
    /** Custom error handler */
    onError?: (error: TypedApiError) => void;
  }
): TypedApiClient {
  const {
    validateResponses = process.env.NODE_ENV === 'development',
    validateRequests = true,
    onError,
  } = options ?? {};

  const client: TypedApiClient = {
    async call<T extends ContractName>(
      contractName: T,
      callOptions?: CallOptions<T>
    ): Promise<ContractResponse<T>> {
      const contract = apiContracts[contractName];
      const { params, body, query, fetchOptions } = callOptions ?? {};

      // Build URL
      let url: string;
      if (typeof contract.path === 'function') {
        url = contract.path(params as Record<string, string>);
      } else {
        url = contract.path;
      }

      // Add query params
      if (query) {
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
          if (value !== undefined) {
            searchParams.append(key, String(value));
          }
        }
        const queryString = searchParams.toString();
        if (queryString) {
          url += `?${queryString}`;
        }
      }

      // Validate request body if schema exists
      let validatedBody: unknown = body;
      if (body && contract.requestSchema && validateRequests) {
        const result = contract.requestSchema.safeParse(body);
        if (!result.success) {
          const error = new TypedApiError(
            `Invalid request for ${contractName}`,
            400,
            'VALIDATION_ERROR',
            result.error.issues
          );
          onError?.(error);
          throw error;
        }
        validatedBody = result.data;
      }

      // Make request
      const response = await fetchFn(url, {
        ...fetchOptions,
        method: contract.method,
        body: validatedBody ? JSON.stringify(validatedBody) : undefined,
      });

      // Validate response if enabled
      if (validateResponses) {
        const result = contract.responseSchema.safeParse(response);
        if (!result.success) {
          console.warn(`Response validation failed for ${contractName}:`, result.error.issues);
          // In development, we warn but still return the data
          // This helps catch API drift without breaking the app
        }
      }

      return response as ContractResponse<T>;
    },

    validateRequest<T extends ContractName>(
      contractName: T,
      data: unknown
    ): ContractRequest<T> {
      const contract = apiContracts[contractName];
      if (!contract.requestSchema) {
        return undefined as ContractRequest<T>;
      }
      return contract.requestSchema.parse(data) as ContractRequest<T>;
    },

    validateResponse<T extends ContractName>(
      contractName: T,
      data: unknown
    ): ContractResponse<T> {
      const contract = apiContracts[contractName];
      return contract.responseSchema.parse(data) as ContractResponse<T>;
    },
  };

  return client;
}

// ============================================================================
// React Hook Factory (for Next.js/React apps)
// ============================================================================

/**
 * Type-safe hook result
 */
export interface UseTypedQueryResult<T> {
  data: T | undefined;
  error: TypedApiError | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Creates a custom hook factory for type-safe queries
 * This is a pattern that can be used with React Query or SWR
 *
 * @example
 * ```typescript
 * // In your app
 * const useQuery = createQueryHookFactory(client);
 *
 * // In a component
 * const { data, isLoading } = useQuery('bots.list');
 * // data is typed as ListBotsResponse | undefined
 * ```
 */
export function createQueryKeys() {
  return {
    // Generate query keys from contract names
    // This helps with cache invalidation
    fromContract: <T extends ContractName>(
      contract: T,
      params?: ContractParams<T>
    ): [T, ContractParams<T> | undefined] => {
      return [contract, params];
    },

    // Pre-defined query keys for common patterns
    bots: {
      all: ['bots.list'] as const,
      detail: (id: string) => ['bots.get', { id }] as const,
      channels: (botId: string) => ['bots.channels.list', { botId }] as const,
      folders: (botId: string) => ['bots.folders.list', { botId }] as const,
    },
    documents: {
      all: ['documents.list'] as const,
      detail: (id: string) => ['documents.get', { id }] as const,
      syncStatus: ['documents.syncStatus'] as const,
    },
    analytics: {
      overview: ['analytics.overview'] as const,
      activity: ['analytics.activity'] as const,
    },
    workspaces: {
      all: ['workspaces.list'] as const,
      detail: (id: string) => ['workspaces.get', { id }] as const,
    },
  };
}

// ============================================================================
// Exports
// ============================================================================

export { apiContracts };
export type { ContractName, ContractRequest, ContractResponse, ContractParams };
