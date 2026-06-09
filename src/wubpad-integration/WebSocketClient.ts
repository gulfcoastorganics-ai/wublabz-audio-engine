import { getWubLabzWsUrl } from './env.js';
import { validateInboundEvent, type ValidatedWubLabzEvent } from '../wublabz/protocol.js';

export type WubConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

export interface WubWebSocketClientOptions {
  url?: string;
  clientId?: string;
  autoConnect?: boolean;
}

export class WubWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimeout: any = null;
  private reconnectDelay = 1000;
  private status: WubConnectionStatus = 'idle';
  private lastError: string | null = null;
  private eventListeners: Set<(event: ValidatedWubLabzEvent) => void> = new Set();
  private statusListeners: Set<(status: WubConnectionStatus, error?: string | null) => void> = new Set();
  private latency = 0;
  private heartbeatInterval: any = null;
  private readonly url: string;
  private readonly clientId: string;

  constructor(options: WubWebSocketClientOptions = {}) {
    this.url = options.url ?? getWubLabzWsUrl();
    this.clientId = options.clientId ?? `wubpad-${Math.random().toString(36).substring(2, 9)}`;
    if (options.autoConnect) {
      this.connect();
    }
  }

  connect() {
    const WebSocketCtor = getWebSocketConstructor();
    if (!WebSocketCtor) {
      this.handleError('WebSocket is unavailable in this browser/runtime');
      return;
    }

    if (this.ws?.readyState === WebSocketCtor.OPEN || this.ws?.readyState === WebSocketCtor.CONNECTING) return;

    this.cleanupReconnect();
    this.setStatus(this.status === 'disconnected' || this.status === 'error' ? 'reconnecting' : 'connecting');
    
    try {
      this.ws = new WebSocketCtor(this.url);
    } catch (err: any) {
      this.handleError(`Failed to create WebSocket: ${err.message}`);
      return;
    }

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.lastError = null;
      this.setStatus('connected');
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const rawEvent = JSON.parse(event.data);
        const result = validateInboundEvent(rawEvent);
        
        if (result.success) {
          const wubEvent = result.event;
          if (wubEvent.type === 'HEARTBEAT' && wubEvent.payload.clientSent) {
            this.latency = Date.now() - wubEvent.payload.clientSent;
          }
          this.eventListeners.forEach((l) => l(wubEvent));
        } else {
          console.warn('Received invalid protocol event', result.rejection);
        }
      } catch (err) {
        console.error('Failed to parse WubEvent', err);
      }
    };

    this.ws.onclose = (event) => {
      const wasConnected = this.status === 'connected';
      this.cleanup();
      
      if (!event.wasClean) {
        this.handleError(`Connection lost (code: ${event.code})`);
      } else {
        this.setStatus('disconnected');
      }
      
      if (wasConnected || this.status === 'reconnecting' || this.status === 'connecting') {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (err) => {
      this.handleError('WebSocket error occurred');
    };
  }

  private handleError(message: string) {
    this.lastError = message;
    this.setStatus('error', message);
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
      this.connect();
    }, this.reconnectDelay);
  }

  private cleanupReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.send('HEARTBEAT', { clientSent: Date.now() });
    }, 5000);
  }

  private cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  send(type: ValidatedWubLabzEvent['type'], payload: any = {}): boolean {
    const WebSocketCtor = getWebSocketConstructor();
    if (!WebSocketCtor || this.ws?.readyState !== WebSocketCtor.OPEN) return false;

    const event = {
      clientId: this.clientId,
      timestamp: Date.now(),
      source: 'wubpad',
      type,
      payload
    };

    const validation = validateInboundEvent(event);
    if (!validation.success) {
      console.error('Refusing to send invalid protocol event', validation.rejection);
      return false;
    }

    this.ws.send(JSON.stringify(validation.event));
    return true;
  }

  onEvent(listener: (event: ValidatedWubLabzEvent) => void) {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onStatusChange(listener: (status: WubConnectionStatus, error?: string | null) => void) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: WubConnectionStatus, error: string | null = null) {
    this.status = status;
    this.statusListeners.forEach((l) => l(status, error));
  }

  getStatus(): WubConnectionStatus {
    return this.status;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  getLatency() {
    return this.latency;
  }

  disconnect() {
    this.cleanupReconnect();
    this.cleanup();
    if (this.ws) {
      this.ws.onclose = null; // Prevent auto-reconnect
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }
}

function getWebSocketConstructor(): typeof WebSocket | null {
  return typeof WebSocket === 'undefined' ? null : WebSocket;
}
