import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RuntimeController } from './runtimeController.js';
import { parseAndValidateInboundEvent } from './protocol.js';
import {
  createHealthResponse,
  findPortOwner,
  formatPortInUseDiagnostics,
  formatStartupDiagnostics,
  isAddressInUseError,
  probeExistingWubLabz,
  resolveWubLabzPort
} from './startup.js';

type ServerResponse = {
  type: string;
  payload?: unknown;
};

const WS_OPEN = 1;

export type WubLabzServerStartResult = 'started' | 'already-running' | 'port-in-use';

export interface WubLabzServerOptions {
  logger?: boolean;
  now?: () => number;
  startedAtMs?: number;
}

export async function createWubLabzServer(options: WubLabzServerOptions = {}) {
  const server = Fastify({ logger: options.logger ?? true });
  await server.register(websocket);

  const runtimeController = new RuntimeController();
  runtimeController.initializeRuntime();
  const startedAtMs = options.startedAtMs ?? Date.now();
  const now = options.now ?? Date.now;

  let activeConnections = 0;

  server.get('/health', async () => {
    return createHealthResponse(startedAtMs, now());
  });

  // WebSocket connection handler
  server.get('/', { websocket: true }, (socket, req) => {
    activeConnections++;
    runtimeController.setActiveConnectionCount(activeConnections);
    const clientId = randomUUID();
    const remoteAddress = req.socket?.remoteAddress ?? req.ip ?? 'unknown';
    console.info(`Client connected: ${clientId} (${remoteAddress})`);
    server.log.info({ clientId, remoteAddress }, 'Client connected');

    const sendResponse = (response: ServerResponse) => {
      if (socket.readyState !== WS_OPEN) return;
      socket.send(JSON.stringify({
        clientId,
        timestamp: Date.now(),
        source: 'wublabz-server',
        ...response
      }));
    };

    // Telemetry loop (50ms = 20Hz for meters)
    const telemetryInterval = setInterval(() => {
        sendResponse({
            type: 'ENGINE_STATUS',
            payload: runtimeController.getRuntimeDiagnostics()
        });
    }, 50);

    // Send initial status
    sendResponse({
      type: 'ENGINE_STATUS',
      payload: runtimeController.getRuntimeDiagnostics()
    });

    socket.on('message', (message: unknown) => {
      console.info(`Message received: ${clientId}`);
      server.log.info({ clientId }, 'Message received');
      const validation = parseAndValidateInboundEvent(toMessageText(message));

      if (!validation.success) {
        sendResponse({
          type: 'EVENT_REJECTED',
          payload: validation.rejection
        });
        return;
      }

      const event = validation.event;

      try {
        const response = runtimeController.handleIntent(event);
        if (response) {
            sendResponse(response);
        }
      } catch (err) {
        server.log.error(err, 'Failed to handle WebSocket event');
      }
    });

    socket.on('close', () => {
      activeConnections--;
      runtimeController.setActiveConnectionCount(activeConnections);
      console.info(`Client disconnected: ${clientId}`);
      server.log.info({ clientId }, 'Client disconnected');
      clearInterval(telemetryInterval);
    });

    socket.on('error', () => {
        clearInterval(telemetryInterval);
    });
  });

  return server;
}

export async function startServer(): Promise<WubLabzServerStartResult> {
  const port = resolveWubLabzPort();

  if (await probeExistingWubLabz(port)) {
    console.log(`WubLabz already running on port ${port}`);
    return 'already-running';
  }

  const server = await createWubLabzServer();

  try {
    await server.listen({ port, host: '0.0.0.0' });
    console.log(formatStartupDiagnostics(port));
    return 'started';
  } catch (err) {
    await server.close().catch(() => undefined);

    if (isAddressInUseError(err)) {
      if (await probeExistingWubLabz(port)) {
        console.log(`WubLabz already running on port ${port}`);
        return 'already-running';
      }

      console.error(formatPortInUseDiagnostics(port, await findPortOwner(port)));
      return 'port-in-use';
    }

    throw err;
  }
}

if (isMainModule()) {
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

function toMessageText(message: unknown): string {
  if (typeof message === 'string') {
    return message;
  }

  if (Buffer.isBuffer(message)) {
    return message.toString('utf8');
  }

  if (message instanceof ArrayBuffer) {
    return Buffer.from(message).toString('utf8');
  }

  if (Array.isArray(message) && message.every(Buffer.isBuffer)) {
    return Buffer.concat(message).toString('utf8');
  }

  return String(message);
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;

  return fileURLToPath(import.meta.url) === path.resolve(entry);
}
