import { describe, expect, it, vi } from 'vitest';
import { createWubLabzServer } from '../src/wublabz/server.js';
import {
  DEFAULT_WUBLABZ_PORT,
  WUBLABZ_VERSION,
  createHealthResponse,
  formatPortInUseDiagnostics,
  formatStartupDiagnostics,
  isWubLabzHealthPayload,
  parseFuserPortOwners,
  parseLsofPortOwners,
  parseProcNetListeningInodes,
  parseSsPortOwners,
  probeExistingWubLabz,
  resolveWubLabzPort
} from '../src/wublabz/startup.js';

describe('WubLabz startup diagnostics', () => {
  it('defaults to port 3001 and honors PORT overrides', () => {
    expect(resolveWubLabzPort({})).toBe(DEFAULT_WUBLABZ_PORT);
    expect(resolveWubLabzPort({ PORT: '3002' })).toBe(3002);
    expect(() => resolveWubLabzPort({ PORT: 'nope' })).toThrow('Invalid PORT "nope"');
  });

  it('builds the requested health payload', () => {
    expect(createHealthResponse(1_000, 6_250)).toEqual({
      status: 'ok',
      version: WUBLABZ_VERSION,
      uptimeSeconds: 5
    });
  });

  it('serves GET /health with the startup health contract', async () => {
    const server = await createWubLabzServer({
      logger: false,
      now: () => 6_250,
      startedAtMs: 1_000
    });

    try {
      const response = await server.inject({ method: 'GET', url: '/health' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        status: 'ok',
        version: WUBLABZ_VERSION,
        uptimeSeconds: 5
      });
    } finally {
      await server.close();
    }
  });

  it('detects current and legacy WubLabz health payloads', async () => {
    expect(isWubLabzHealthPayload({ status: 'ok', version: WUBLABZ_VERSION, uptimeSeconds: 1 })).toBe(true);
    expect(isWubLabzHealthPayload({ ok: true, service: 'wublabz' })).toBe(true);
    expect(isWubLabzHealthPayload({ status: 'ok', version: 'other' })).toBe(false);

    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: 'ok', version: WUBLABZ_VERSION, uptimeSeconds: 1 })
    }));

    await expect(probeExistingWubLabz(3001, fetchImpl)).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:3001/health', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('parses port owner output from common platform tools', () => {
    expect(
      parseProcNetListeningInodes(`  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 00000000:0BB9 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 45678`, 3001)
    ).toEqual(['45678']);

    expect(
      parseLsofPortOwners(`COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
node    12345 user   19u  IPv4 12345      0t0  TCP *:3001 (LISTEN)`)
    ).toEqual([{ pid: 12345, command: 'node', source: 'lsof' }]);

    expect(
      parseSsPortOwners('LISTEN 0 511 0.0.0.0:3001 0.0.0.0:* users:(("next-server",pid=23456,fd=21))')
    ).toEqual([{ pid: 23456, command: 'next-server', source: 'ss' }]);

    expect(
      parseFuserPortOwners(`                     USER        PID ACCESS COMMAND
3001/tcp:            user      34567 F.... node`)
    ).toEqual([{ pid: 34567, command: 'node', source: 'fuser' }]);
  });

  it('prints actionable startup and occupied-port diagnostics', () => {
    expect(formatStartupDiagnostics(3001)).toContain('WubLabz Engine Started');
    expect(formatStartupDiagnostics(3001)).toContain('Health: http://localhost:3001/health');

    const message = formatPortInUseDiagnostics(3001, { pid: 12345, command: 'node', source: 'lsof' });

    expect(message).toContain('Port 3001 is already in use by another process.');
    expect(message).toContain('PID: 12345');
    expect(message).toContain('Process: node');
    expect(message).toContain('PORT=3002 npm run wublabz');
  });
});
