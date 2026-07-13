import { createServer } from 'node:net';

const HOST = '127.0.0.1';

const probe = (port) =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once('error', reject);
    server.listen(port, HOST, () => {
      const address = server.address();
      const selected = address && typeof address !== 'string' ? address.port : null;
      server.close((error) => (error ? reject(error) : resolve(selected)));
    });
  });

export async function findAvailableLoopbackPort(preferredPort) {
  try {
    const preferred = await probe(preferredPort);
    if (preferred !== null) return preferred;
  } catch (error) {
    if (
      !error ||
      typeof error !== 'object' ||
      !('code' in error) ||
      error.code !== 'EADDRINUSE'
    ) {
      throw error;
    }
  }

  const fallback = await probe(0);
  if (fallback === null) throw new Error('Could not allocate a loopback preview port');
  return fallback;
}
