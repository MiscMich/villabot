/**
 * Request Validation Middleware
 * Uses Zod schemas to validate request bodies, params, and queries
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../utils/logger.js';

/**
 * Format Zod errors into a user-friendly structure
 */
function formatZodErrors(error: ZodError): Record<string, string> {
  const formatted: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.');
    formatted[path || '_root'] = issue.message;
  }

  return formatted;
}

/**
 * Middleware factory to validate request body against a Zod schema
 *
 * @example
 * const createUserSchema = z.object({
 *   email: z.string().email(),
 *   name: z.string().min(1),
 * });
 *
 * router.post('/users', validateBody(createUserSchema), (req, res) => {
 *   // req.body is now typed and validated
 * });
 */
export function validateBody<T extends ZodSchema>(
  schema: T
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await schema.parseAsync(req.body);
      req.body = result;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Request validation failed', {
          path: req.path,
          method: req.method,
          errors: error.issues,
        });

        res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: formatZodErrors(error),
        });
        return;
      }

      // Unexpected error
      logger.error('Unexpected validation error', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  };
}

/**
 * Middleware factory to validate request query parameters
 */
export function validateQuery<T extends ZodSchema>(
  schema: T
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await schema.parseAsync(req.query);
      req.query = result;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: formatZodErrors(error),
        });
        return;
      }

      logger.error('Unexpected validation error', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  };
}

/**
 * Middleware factory to validate request URL parameters
 */
export function validateParams<T extends ZodSchema>(
  schema: T
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await schema.parseAsync(req.params);
      req.params = result;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: 'Invalid URL parameters',
          code: 'VALIDATION_ERROR',
          details: formatZodErrors(error),
        });
        return;
      }

      logger.error('Unexpected validation error', { error });
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  };
}
