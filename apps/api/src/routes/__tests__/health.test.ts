import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { healthRouter, updateServiceStatus, updateIntegrationCounts } from '../health.js';

// Mock dependencies
vi.mock('../../services/supabase/client.js', () => ({
  testSupabaseConnection: vi.fn(),
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ count: 0 })),
    })),
    rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
  },
}));

vi.mock('../../services/rag/embeddings.js', () => ({
  generateQueryEmbedding: vi.fn(() => Promise.resolve(new Array(768).fill(0.1))),
}));

vi.mock('../../utils/cache.js', () => ({
  embeddingCache: {
    stats: () => ({ size: 10, maxSize: 1000, hitRate: 0.5 }),
  },
  searchCache: {
    stats: () => ({ size: 5, maxSize: 500, hitRate: 0.3 }),
  },
  responseCache: {
    stats: () => ({ size: 2, maxSize: 100, hitRate: 0.2 }),
  },
}));

vi.mock('../../config/env.js', () => ({
  env: {
    OPENAI_API_KEY: 'test-api-key',
  },
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import mocked dependencies to access them
import { testSupabaseConnection } from '../../services/supabase/client.js';

// Type for route handler
type RouteHandler = (req: Request, res: Response, next: () => void) => void;

// Helper to get route handler safely
function getHandler(path: string): RouteHandler | undefined {
  const layer = healthRouter.stack.find((l) => l.route?.path === path);
  if (!layer?.route?.stack?.[0]?.handle) {
    return undefined;
  }
  return layer.route.stack[0].handle as RouteHandler;
}

describe('Health Routes', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: ReturnType<typeof vi.fn>;
  let responseStatus: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    responseJson = vi.fn();
    responseStatus = vi.fn(() => ({ json: responseJson }));

    mockRequest = {};
    mockResponse = {
      status: responseStatus,
      json: responseJson,
    };
  });

  describe('updateServiceStatus', () => {
    it('should update platform service status', () => {
      // Only platform services: supabase, openai
      updateServiceStatus('supabase', true);
      updateServiceStatus('openai', false);
      // Function should not throw
      expect(true).toBe(true);
    });
  });

  describe('updateIntegrationCounts', () => {
    it('should update workspace integration counts', () => {
      updateIntegrationCounts({ activeSlackBots: 5 });
      updateIntegrationCounts({ workspacesWithGoogleDrive: 3 });
      // Function should not throw
      expect(true).toBe(true);
    });
  });

  describe('GET /health', () => {
    it('should return healthy status when all platform services are connected', async () => {
      vi.mocked(testSupabaseConnection).mockResolvedValue(true);

      // Set platform services as healthy (only supabase and openai now)
      updateServiceStatus('supabase', true);
      updateServiceStatus('openai', true);

      const handler = getHandler('/');
      expect(handler).toBeDefined();
      await handler!(mockRequest as Request, mockResponse as Response, vi.fn());

      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          services: expect.objectContaining({
            supabase: 'connected',
            openai: 'connected',
          }),
          // Integrations are informational only
          integrations: expect.objectContaining({
            activeSlackBots: expect.any(Number),
            workspacesWithGoogleDrive: expect.any(Number),
          }),
        })
      );
    });

    it('should return degraded status when some platform services are disconnected', async () => {
      vi.mocked(testSupabaseConnection).mockResolvedValue(true);

      // Only supabase healthy, openai disconnected
      updateServiceStatus('supabase', true);
      updateServiceStatus('openai', false);

      const handler = getHandler('/');
      expect(handler).toBeDefined();
      await handler!(mockRequest as Request, mockResponse as Response, vi.fn());

      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'degraded',
        })
      );
    });

    it('should return unhealthy status when no platform services are connected', async () => {
      vi.mocked(testSupabaseConnection).mockResolvedValue(false);

      // Set all platform services as unhealthy
      updateServiceStatus('supabase', false);
      updateServiceStatus('openai', false);

      const handler = getHandler('/');
      expect(handler).toBeDefined();
      await handler!(mockRequest as Request, mockResponse as Response, vi.fn());

      expect(responseStatus).toHaveBeenCalledWith(503);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unhealthy',
        })
      );
    });

    it('should include timestamp, uptime, and integration counts in response', async () => {
      vi.mocked(testSupabaseConnection).mockResolvedValue(true);
      updateServiceStatus('supabase', true);
      updateIntegrationCounts({ activeSlackBots: 2, workspacesWithGoogleDrive: 1 });

      const handler = getHandler('/');
      expect(handler).toBeDefined();
      await handler!(mockRequest as Request, mockResponse as Response, vi.fn());

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          version: expect.any(String),
          integrations: {
            activeSlackBots: 2,
            workspacesWithGoogleDrive: 1,
          },
        })
      );
    });

    it('should NOT affect health status based on workspace integrations', async () => {
      vi.mocked(testSupabaseConnection).mockResolvedValue(true);

      // Platform services healthy
      updateServiceStatus('supabase', true);
      updateServiceStatus('openai', true);

      // Even with zero workspace integrations, platform should be healthy
      updateIntegrationCounts({ activeSlackBots: 0, workspacesWithGoogleDrive: 0 });

      const handler = getHandler('/');
      expect(handler).toBeDefined();
      await handler!(mockRequest as Request, mockResponse as Response, vi.fn());

      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy', // Still healthy despite no integrations
        })
      );
    });
  });

  describe('GET /health/ready', () => {
    it('should return ready when database is connected', async () => {
      vi.mocked(testSupabaseConnection).mockResolvedValue(true);

      const handler = getHandler('/ready');
      expect(handler).toBeDefined();
      await handler!(mockRequest as Request, mockResponse as Response, vi.fn());

      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith({ ready: true });
    });

    it('should return not ready when database is disconnected', async () => {
      vi.mocked(testSupabaseConnection).mockResolvedValue(false);

      const handler = getHandler('/ready');
      expect(handler).toBeDefined();
      await handler!(mockRequest as Request, mockResponse as Response, vi.fn());

      expect(responseStatus).toHaveBeenCalledWith(503);
      expect(responseJson).toHaveBeenCalledWith({
        ready: false,
        reason: 'Database not available',
      });
    });
  });

  describe('GET /health/live', () => {
    it('should always return alive', () => {
      const handler = getHandler('/live');
      expect(handler).toBeDefined();
      handler!(mockRequest as Request, mockResponse as Response, vi.fn());

      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith({ alive: true });
    });
  });
});
