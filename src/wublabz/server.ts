import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { randomUUID } from 'node:crypto';
import { RuntimeController } from './runtimeController.js';

const PORT = 3001;

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

    const sendResponse = (response: any) => {
      connection.socket.send(JSON.stringify({
        clientId,
        timestamp: Date.now(),
        source: 'wublabz-server',
        ...response
      }));
    };

    // Send initial status
    sendResponse({
      type: 'ENGINE_STATUS',
      payload: runtimeController.getRuntimeDiagnostics()
    });

    connection.socket.on('message', (message: any) => {
      try {
        const event = JSON.parse(message.toString());

        // Protocol validation
        if (!event.type || !event.source) {
          sendResponse({
            type: 'EVENT_REJECTED',
            payload: { reason: 'Missing event type or source', originalEvent: event }
          });
          return;
        }

        switch (event.type) {
          case 'HEARTBEAT':
            sendResponse({
              type: 'HEARTBEAT',
              payload: { ...event.payload, serverReceived: Date.now() }
            });
            sendResponse({
              type: 'ENGINE_STATUS',
              payload: runtimeController.getRuntimeDiagnostics()
            });
            break;

          case 'EMERGENCY_STOP':
            server.log.warn('EMERGENCY STOP RECEIVED');
            sendResponse(runtimeController.handleEmergencyStop());
            break;

          case 'TRANSPORT_CONTROL':
            sendResponse(runtimeController.handleTransportControl(event.payload));
            break;

          case 'SCENE_TRIGGER':
            sendResponse(runtimeController.handleSceneTrigger(event.payload));
            break;

          case 'MODULATION':
            sendResponse(runtimeController.handleModulation(event.payload));
            break;

          case 'PERFORMANCE_MACRO':
            sendResponse(runtimeController.handlePerformanceMacro(event.payload));
            break;

          default:
            server.log.info(`Unhandled event type: ${event.type}`);
            sendResponse({
              type: 'EVENT_REJECTED',
              payload: { reason: 'Unknown event type', originalEvent: event }
            });
        }
      } catch (err) {
        server.log.error(err, 'Failed to parse WebSocket message');
      }
    });

    connection.socket.on('close', () => {
      server.log.info(`Client disconnected: ${clientId}`);
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
