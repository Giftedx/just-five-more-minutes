import { createServer } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { findAvailableLoopbackPort } from './available-port.mjs';

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

describe('findAvailableLoopbackPort', () => {
  it('returns an operating-system port when zero is requested', async () => {
    const port = await findAvailableLoopbackPort(0);
    expect(port).toBeGreaterThan(0);
  });

  it('moves away from an occupied preferred port', async () => {
    const occupied = createServer();
    servers.push(occupied);
    await new Promise<void>((resolve, reject) => {
      occupied.once('error', reject);
      occupied.listen(0, '127.0.0.1', resolve);
    });
    const address = occupied.address();
    if (!address || typeof address === 'string') throw new Error('missing occupied port');

    const selected = await findAvailableLoopbackPort(address.port);

    expect(selected).not.toBe(address.port);
    expect(selected).toBeGreaterThan(0);
  });
});
