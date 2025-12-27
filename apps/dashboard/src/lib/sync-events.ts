/**
 * Sync Events SSE Client
 * Manages real-time sync progress updates via Server-Sent Events
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export type SyncOperationType = 'drive_sync' | 'website_scrape' | 'drive_full_sync';
export type SyncOperationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SyncProgressEvent {
  operationId: string;
  workspaceId: string;
  type: SyncOperationType;
  status: SyncOperationStatus;
  progress: number;
  totalItems: number;
  processedItems: number;
  currentItem?: string;
  result?: {
    added: number;
    updated: number;
    removed: number;
    errors: string[];
  };
  error?: string;
  timestamp: string;
}

export interface SyncEventSourceOptions {
  onProgress?: (event: SyncProgressEvent) => void;
  onConnected?: (workspaceId: string) => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  maxReconnectAttempts?: number;
  reconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  heartbeatTimeoutMs?: number;
}

/**
 * SSE Client for sync progress updates
 * Automatically reconnects with exponential backoff
 */
export class SyncEventSource {
  private eventSource: EventSource | null = null;
  private token: string;
  private options: Required<Pick<SyncEventSourceOptions, 'maxReconnectAttempts' | 'reconnectDelayMs' | 'maxReconnectDelayMs' | 'heartbeatTimeoutMs'>> & SyncEventSourceOptions;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatTimeout: NodeJS.Timeout | null = null;
  private lastHeartbeat = 0;
  private isConnecting = false;
  private isClosed = false;

  constructor(token: string, options: SyncEventSourceOptions = {}) {
    this.token = token;
    this.options = {
      maxReconnectAttempts: 10,
      reconnectDelayMs: 1000,
      maxReconnectDelayMs: 30000, // Cap at 30 seconds
      heartbeatTimeoutMs: 45000,  // Expect heartbeat every 30s, timeout at 45s
      ...options,
    };
  }

  /**
   * Connect to the SSE endpoint
   */
  connect(): void {
    if (this.isConnecting || this.isClosed) return;
    if (this.eventSource) {
      this.disconnect();
    }

    this.isConnecting = true;
    this.reconnectAttempts = 0;

    try {
      // EventSource doesn't support custom headers, so we pass token as query param
      // The backend should accept this for SSE connections
      const url = `${API_BASE}/api/sync/events?token=${encodeURIComponent(this.token)}`;
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeatMonitor();
      };

      // Handle connected event
      this.eventSource.addEventListener('connected', (event) => {
        try {
          const data = JSON.parse(event.data);
          this.resetHeartbeat();
          this.options.onConnected?.(data.workspaceId);
        } catch (error) {
          console.error('Failed to parse connected event', error);
        }
      });

      // Handle heartbeat events
      this.eventSource.addEventListener('heartbeat', () => {
        this.resetHeartbeat();
      });

      // Handle progress events for all types
      for (const eventType of ['drive_sync', 'drive_full_sync', 'website_scrape']) {
        this.eventSource.addEventListener(eventType, (event) => {
          try {
            const data = JSON.parse(event.data) as SyncProgressEvent;
            this.options.onProgress?.(data);
          } catch (error) {
            console.error(`Failed to parse ${eventType} event`, error);
          }
        });
      }

      this.eventSource.onerror = (error) => {
        this.isConnecting = false;
        console.error('SSE connection error', error);

        if (this.eventSource?.readyState === EventSource.CLOSED) {
          this.options.onDisconnected?.();
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      this.isConnecting = false;
      this.options.onError?.(error instanceof Error ? error : new Error('Failed to connect'));
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff and jitter
   */
  private scheduleReconnect(): void {
    if (this.isClosed) return;

    const maxAttempts = this.options.maxReconnectAttempts;
    if (this.reconnectAttempts >= maxAttempts) {
      this.options.onError?.(new Error(`Max reconnection attempts (${maxAttempts}) reached`));
      return;
    }

    // Exponential backoff with jitter
    const baseDelay = this.options.reconnectDelayMs;
    const maxDelay = this.options.maxReconnectDelayMs;
    const exponentialDelay = baseDelay * Math.pow(2, this.reconnectAttempts);
    const cappedDelay = Math.min(exponentialDelay, maxDelay);
    // Add jitter: random value between 0-30% of delay to prevent thundering herd
    const jitter = cappedDelay * Math.random() * 0.3;
    const delay = Math.floor(cappedDelay + jitter);

    this.reconnectAttempts++;
    console.log(`SSE reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${maxAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      if (!this.isClosed) {
        this.connect();
      }
    }, delay);
  }

  /**
   * Start heartbeat monitor to detect stale connections
   */
  private startHeartbeatMonitor(): void {
    this.resetHeartbeat();
  }

  /**
   * Reset heartbeat timer
   */
  private resetHeartbeat(): void {
    this.lastHeartbeat = Date.now();

    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
    }

    this.heartbeatTimeout = setTimeout(() => {
      if (!this.isClosed && this.eventSource) {
        console.warn('SSE heartbeat timeout - connection may be stale, reconnecting...');
        this.disconnect();
        this.scheduleReconnect();
      }
    }, this.options.heartbeatTimeoutMs);
  }

  /**
   * Stop heartbeat monitor
   */
  private stopHeartbeatMonitor(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Disconnect from SSE endpoint
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopHeartbeatMonitor();

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.isConnecting = false;
  }

  /**
   * Close the connection permanently (no reconnection)
   */
  close(): void {
    this.isClosed = true;
    this.disconnect();
    this.options.onDisconnected?.();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }

  /**
   * Update the auth token (requires reconnect)
   */
  updateToken(token: string): void {
    this.token = token;
    if (this.eventSource) {
      this.disconnect();
      this.connect();
    }
  }
}

/**
 * Fetch active sync operations for a workspace
 */
export async function getActiveOperations(token: string): Promise<SyncProgressEvent[]> {
  const response = await fetch(`${API_BASE}/api/sync/operations`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch active operations');
  }

  const data = await response.json();
  return data.operations;
}

/**
 * Fetch recent sync operations for a workspace
 */
export async function getRecentOperations(token: string, limit = 10): Promise<SyncProgressEvent[]> {
  const response = await fetch(`${API_BASE}/api/sync/operations/recent?limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch recent operations');
  }

  const data = await response.json();
  return data.operations;
}

/**
 * Cancel a sync operation
 */
export async function cancelOperation(token: string, operationId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/sync/operations/${operationId}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to cancel operation');
  }
}
