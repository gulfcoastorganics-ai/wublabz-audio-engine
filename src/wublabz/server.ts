import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { randomUUID } from 'node:crypto';
import { RuntimeController } from './runtimeController.js';
import { parseAndValidateInboundEvent } from './protocol.js';

const PORT = 3001;

type ServerResponse = {
  type: string;
  payload?: unknown;
};

async function startServer() {
  const server = Fastify({ logger: true });

  await server.register(websocket);

  const runtimeController = new RuntimeController();
  runtimeController.initializeRuntime();

  // Health check endpoint
  server.get('/health', async () => {
    return {
      ok: true,
      service: 'wublabz',
      engineReady: runtimeController.getRuntimeDiagnostics().engineReady,
      wsPath: '/',
      timestamp: Date.now()
    };
  });

  // WebSocket connection handler
  server.get('/', { websocket: true }, (connection, req) => {
    const clientId = randomUUID();
    server.log.info(`Client connected: ${clientId}`);

    const sendResponse = (response: ServerResponse) => {
      if (connection.socket.readyState !== 1) return;
      connection.socket.send(JSON.stringify({
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

    connection.socket.on('message', (message: unknown) => {
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

    connection.socket.on('close', () => {
      server.log.info(`Client disconnected: ${clientId}`);
      clearInterval(telemetryInterval);
    });

    connection.socket.on('error', () => {
        clearInterval(telemetryInterval);
    });
  });

  try {
    const address = await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`WubLabz Backend running at ${address}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

startServer();

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
