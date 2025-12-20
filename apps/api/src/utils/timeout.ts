/**
 * Timeout utility for async operations
 */

export class TimeoutError extends Error {
  constructor(operation: string, timeoutMs: number) {
    super(`Operation timed out: ${operation} (${timeoutMs}ms)`);
    this.name = 'TimeoutError';
  }
}

/**
 * Wrap an async operation with a timeout
 */
export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  operationName: string = 'operation'
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(operationName, timeoutMs));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([operation, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Retry an operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    retryCondition?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    retryCondition = () => true,
  } = options;

  let lastError: Error;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries || !retryCondition(lastError)) {
        throw lastError;
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError!;
}

/**
 * Wrap an operation with both timeout and retry
 */
export async function withTimeoutAndRetry<T>(
  operation: () => Promise<T>,
  options: {
    timeoutMs: number;
    operationName: string;
    maxRetries?: number;
    initialDelayMs?: number;
  }
): Promise<T> {
  const { timeoutMs, operationName, maxRetries = 2, initialDelayMs = 1000 } = options;

  return withRetry(
    () => withTimeout(operation(), timeoutMs, operationName),
    {
      maxRetries,
      initialDelayMs,
      retryCondition: (error) => {
        // Retry on timeout or transient errors
        return error instanceof TimeoutError ||
               error.message.includes('ECONNRESET') ||
               error.message.includes('ETIMEDOUT') ||
               error.message.includes('rate limit');
      },
    }
  );
}
