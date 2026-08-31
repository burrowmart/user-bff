import { BadGatewayException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { ProfileService } from '../src/profile/profile.service';

const configValues: Record<string, unknown> = {
  userServiceUrl: 'http://user-service.test',
  notificationServiceUrl: 'http://notification-service.test',
};
const config = { get: (key: string) => configValues[key] } as unknown as ConfigService;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: { get: () => 'application/json' },
    json: async () => body,
  } as unknown as Response;
}

describe('ProfileService', () => {
  let service: ProfileService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    service = new ProfileService(config);
    fetchMock = jest.fn();
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  });

  it('aggregates user-service + notification-service in parallel, forwarding the caller credential', async () => {
    const calls: string[] = [];
    fetchMock.mockImplementation(async (url: string) => {
      calls.push(url);
      if (url.includes('/users/')) {
        return jsonResponse(200, {
          email: 'alice@example.com',
          name: 'Alice',
          roles: ['user'],
          attributes: {},
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        });
      }
      return jsonResponse(200, { count: 3 });
    });

    const profile = await service.getProfile('alice@example.com', { authorization: 'Bearer tok' });

    expect(profile).toEqual(
      expect.objectContaining({ email: 'alice@example.com', name: 'Alice', unreadNotifications: 3 }),
    );
    // Both downstream calls happened, and the caller's own credential was forwarded to each —
    // each callee's Envoy PEP verifies the JWT signature on every hop.
    expect(calls).toHaveLength(2);
    for (const [, init] of fetchMock.mock.calls) {
      expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok');
    }
  });

  it('throws NotFoundException when user-service has no such user', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/users/') ? jsonResponse(404, { message: 'not found' }) : jsonResponse(200, { count: 0 }),
    );

    await expect(service.getProfile('missing@example.com', {})).rejects.toThrow(NotFoundException);
  });

  it('throws BadGatewayException when a downstream call fails outright', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.getProfile('alice@example.com', {})).rejects.toThrow(BadGatewayException);
  });
});
