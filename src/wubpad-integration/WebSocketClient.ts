import { getWubLabzWsUrl } from './env.js';

export type WubEvent = {
  clientId?: string;
  timestamp: number;
  source: string;
  type: string;
  payload: any;
};

export class WubWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectTimeout: any = null;
  private reconnectDelay = 1000;
  private listeners: Set<(event: WubEvent) => void> = new Set();
  private statusListeners: Set<(status: 'connecting' | 'open' | 'closed' | 'error') => void> = new Set();
  private latency = 0;
  private heartbeatInterval: any = null;

  constructor(private readonly url: string = getWubLabzWsUrl()) {}

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.notifyStatus('connecting');
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('WubLabz WebSocket connected');
      this.reconnectDelay = 1000;
      this.notifyStatus('open');
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const wubEvent = JSON.parse(event.data) as WubEvent;
        if (wubEvent.type === 'HEARTBEAT') {
          this.latency = Date.now() - wubEvent.payload.clientSent;
        }
        this.listeners.forEach((l) => l(wubEvent));
      } catch (err) {
        console.error('Failed to parse WubEvent', err);
      }
    };

    this.ws.onclose = () => {
      this.notifyStatus('closed');
      this.cleanup();
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('WubLabz WebSocket error', err);
      this.notifyStatus('error');
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
      this.connect();
    }, this.reconnectDelay);
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

  send(type: string, payload: any = {}) {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;

    const event: WubEvent = {
      timestamp: Date.now(),
      source: 'wubpad',
      type,
      payload
    };

    this.ws.send(JSON.stringify(event));
    return true;
  }

  onEvent(listener: (event: WubEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onStatusChange(listener: (status: 'connecting' | 'open' | 'closed' | 'error') => void) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private notifyStatus(status: 'connecting' | 'open' | 'closed' | 'error') {
    this.statusListeners.forEach((l) => l(status));
  }

  getLatency() {
    return this.latency;
  }

  close() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.cleanup();
    this.ws?.close();
  }
}
