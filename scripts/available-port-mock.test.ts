import { vi, describe, expect, it } from 'vitest';
import { findAvailableLoopbackPort } from './available-port.mjs';

vi.mock('node:net', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createServer: () => {
      let errorCb;
      const server = {
        unref: () => {},
        once: (evt, cb) => {
          if (evt === 'error') errorCb = cb;
        },
        listen: (port, host, cb) => {
          if (port === 12345) {
             const err = new Error();
             err.code = 'EACCES';
             setTimeout(() => errorCb(err), 0);
          } else {
             setTimeout(cb, 0);
          }
        },
        address: () => ({ port: 54321 }),
        close: (cb) => { setTimeout(cb, 0); }
      };
      return server;
    }
  };
});

describe('findAvailableLoopbackPort with mock', () => {
  it('moves away from an access-denied preferred port', async () => {
    const selected = await findAvailableLoopbackPort(12345);
    expect(selected).toBe(54321);
  });
});
