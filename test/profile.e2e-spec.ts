/**
 * user-bff e2e verification.
 *
 * user-service and notification-service are minimal in-process HTTP stubs
 * started by test/global-setup.ts (USER_SERVICE_URL / NOTIFICATION_SERVICE_URL).
 * The app is bound to a real listening port (app.listen(0)) and driven with
 * native fetch — see cart-bff/chat-service's e2e suites for why.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';

describe('Profile (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.listen(0);
    const address = app.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  const asJson = async <T>(res: Response): Promise<T> => (await res.json()) as T;

  it('GET /health — returns ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(await asJson(res)).toEqual({ status: 'ok' });
  });

  it('GET /profile — aggregates user-service + notification-service', async () => {
    const res = await fetch(`${baseUrl}/profile`, {
      headers: { 'x-test-user-email': 'alice@example.com', authorization: 'Bearer test-token' },
    });
    expect(res.status).toBe(200);

    const body = await asJson<{ email: string; name: string; unreadNotifications: number }>(res);
    expect(body.email).toBe('alice@example.com');
    expect(body.name).toBe('Stub User');
    expect(body.unreadNotifications).toBe(4);
  });

  it('GET /profile — forwards the caller\'s credential to notification-service, not a BFF-minted one', async () => {
    await fetch(`${baseUrl}/profile`, { headers: { 'x-test-user-email': 'bob@example.com' } });

    const debug = await fetch(`${process.env.NOTIFICATION_SERVICE_URL}/debug/last-seen-email`);
    const body = await asJson<{ email: string }>(debug);
    expect(body.email).toBe('bob@example.com');
  });

  it('GET /profile — 404 when user-service has no such user', async () => {
    const res = await fetch(`${baseUrl}/profile`, {
      headers: { 'x-test-user-email': 'missing@example.com' },
    });
    expect(res.status).toBe(404);
  });
});
