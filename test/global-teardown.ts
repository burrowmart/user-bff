import type { Server } from 'node:http';

export default async function globalTeardown(): Promise<void> {
  const users = (global as { __USER_STUB__?: Server }).__USER_STUB__;
  const notifications = (global as { __NOTIFICATION_STUB__?: Server }).__NOTIFICATION_STUB__;
  await Promise.all([
    new Promise<void>((resolve) => (users ? users.close(() => resolve()) : resolve())),
    new Promise<void>((resolve) => (notifications ? notifications.close(() => resolve()) : resolve())),
  ]);
}
