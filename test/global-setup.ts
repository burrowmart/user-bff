/**
 * Jest globalSetup — runs once before any test file is loaded.
 *
 * user-bff has no datastore of its own. Its only two dependencies are
 * user-service and notification-service, both stood up here as minimal
 * in-process HTTP stubs so the e2e suite doesn't depend on either actually
 * running.
 */
import { createServer, type Server } from 'node:http';

/** Echoes back a fixed profile for any email, except 'missing@example.com' -> 404. */
function startUserStub(): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const match = /^\/users\/([^/]+)$/.exec(req.url ?? '');
      if (req.method === 'GET' && match) {
        const email = decodeURIComponent(match[1]);
        if (email === 'missing@example.com') {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'not found' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            email,
            name: 'Stub User',
            roles: ['user'],
            attributes: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        );
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'not found' }));
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/**
 * Returns a fixed unread count, and records the forwarded x-test-user-email
 * so the e2e suite can prove the caller's credential actually propagated —
 * exposed via a debug endpoint since the real response doesn't carry it.
 */
function startNotificationStub(): Promise<Server> {
  let lastSeenEmail = '';
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/notifications/unread-count') {
        lastSeenEmail = String(req.headers['x-test-user-email'] ?? '');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ count: 4 }));
        return;
      }
      if (req.method === 'GET' && req.url === '/debug/last-seen-email') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ email: lastSeenEmail }));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'not found' }));
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function port(server: Server): number {
  const addr = server.address();
  if (typeof addr !== 'object' || addr === null) throw new Error('stub server failed to bind a TCP port');
  return addr.port;
}

export default async function globalSetup(): Promise<void> {
  const [users, notifications] = await Promise.all([startUserStub(), startNotificationStub()]);

  process.env.PORT = '3011';
  process.env.AUTH_DISABLED = 'true';
  process.env.USER_SERVICE_URL = `http://127.0.0.1:${port(users)}`;
  process.env.NOTIFICATION_SERVICE_URL = `http://127.0.0.1:${port(notifications)}`;

  (global as { __USER_STUB__?: Server }).__USER_STUB__ = users;
  (global as { __NOTIFICATION_STUB__?: Server }).__NOTIFICATION_STUB__ = notifications;
}
