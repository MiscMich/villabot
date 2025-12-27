/**
 * Typed API Client Utilities
 * Helper functions for creating type-safe API calls using Zod schemas
 */

import { z } from 'zod';

/**
 * API Error with typed structure
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Result type for API calls - either success with data or error
 */
export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };

/**
 * Options for API calls
 */
export interface ApiCallOptions<TResponse extends z.ZodType> {
  /** Response schema for validation */
  responseSchema: TResponse;
  /** Whether to validate response (default: true in development) */
  validateResponse?: boolean;
  /** Transform response before returning */
  transform?: (data: z.infer<TResponse>) => z.infer<TResponse>;
}

/**
 * Validate response data against a Zod schema
 * Throws ApiError if validation fails
 */
export function validateResponse<T extends z.ZodType>(
  schema: T,
  data: unknown,
  endpoint: string
): z.infer<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    console.error(`API Response validation failed for ${endpoint}:`, result.error.issues);
    throw new ApiError(
      `Invalid response from ${endpoint}`,
      500,
      'VALIDATION_ERROR',
      { issues: result.error.issues }
    );
  }

  return result.data;
}

/**
 * Safe API call wrapper that returns Result type instead of throwing
 */
export async function safeApiCall<T>(
  fn: () => Promise<T>
): Promise<ApiResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, error };
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: new ApiError(message, 500) };
  }
}

/**
 * Create a typed fetch function for an endpoint
 *
 * Example usage:
 * ```typescript
 * const getBots = createTypedFetch('/api/bots', 'GET', ListBotsResponseSchema);
 * const result = await getBots(fetchFn);
 * // result is fully typed as { bots: Bot[]; total: number }
 * ```
 */
export function createTypedFetch<TResponse extends z.ZodType>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  responseSchema: TResponse,
  options?: { validateInDev?: boolean }
) {
  return async (
    fetchFn: <T>(endpoint: string, options?: RequestInit) => Promise<T>,
    requestOptions?: RequestInit
  ): Promise<z.infer<TResponse>> => {
    const data = await fetchFn(endpoint, { ...requestOptions, method });

    // Validate in development by default
    const shouldValidate = options?.validateInDev !== false &&
      typeof process !== 'undefined' &&
      process.env?.NODE_ENV === 'development';

    if (shouldValidate) {
      return validateResponse(responseSchema, data, endpoint);
    }

    return data as z.infer<TResponse>;
  };
}

/**
 * Create a typed mutation function for POST/PATCH/PUT endpoints
 *
 * Example usage:
 * ```typescript
 * const createBot = createTypedMutation(
 *   '/api/bots',
 *   'POST',
 *   CreateBotRequestSchema,
 *   CreateBotResponseSchema
 * );
 * const result = await createBot(fetchFn, { name: 'MyBot', slug: 'mybot' });
 * ```
 */
export function createTypedMutation<
  TRequest extends z.ZodType,
  TResponse extends z.ZodType
>(
  endpoint: string | ((id: string) => string),
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  requestSchema: TRequest,
  responseSchema: TResponse
) {
  return async (
    fetchFn: <T>(endpoint: string, options?: RequestInit) => Promise<T>,
    data?: z.infer<TRequest>,
    id?: string
  ): Promise<z.infer<TResponse>> => {
    // Validate request data if provided
    if (data && requestSchema) {
      const parsed = requestSchema.safeParse(data);
      if (!parsed.success) {
        throw new ApiError(
          'Invalid request data',
          400,
          'VALIDATION_ERROR',
          { issues: parsed.error.issues }
        );
      }
    }

    const url = typeof endpoint === 'function' ? endpoint(id!) : endpoint;

    const response = await fetchFn(url, {
      method,
      body: data ? JSON.stringify(data) : undefined,
    });

    // Validate response in development
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      return validateResponse(responseSchema, response, url);
    }

    return response as z.infer<TResponse>;
  };
}

/**
 * Type helper for extracting response type from a schema
 */
export type InferResponse<T extends z.ZodType> = z.infer<T>;

/**
 * Type helper for extracting request type from a schema
 */
export type InferRequest<T extends z.ZodType> = z.infer<T>;
