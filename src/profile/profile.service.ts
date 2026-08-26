import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createUserServiceClient, createNotificationServiceClient, FetchError, type User } from '@demo/contracts';
import { getCorrelationId } from '../common/correlation/correlation.context';

export interface ProfileResponse extends User {
  /** Sourced from notification-service's Redis hot layer, never Mongo */
  unreadNotifications: number;
}

@Injectable()
export class ProfileService {
  constructor(private readonly config: ConfigService) {}

  // Fresh client per call: correlationId lives in AsyncLocalStorage and
  // changes per request, while createXServiceClient() bakes defaultHeaders in
  // at construction time. authHeaders forwards the caller's own credential —
  // both downstream services independently verify the Cognito JWT (global
  // guard), so a request arriving without it would 401 in a real deployment.
  private userClient(authHeaders: Record<string, string>) {
    return createUserServiceClient({
      baseUrl: this.config.get<string>('userServiceUrl')!,
      defaultHeaders: { ...authHeaders, ...this.correlationHeaders() },
    });
  }

  private notificationClient(authHeaders: Record<string, string>) {
    return createNotificationServiceClient({
      baseUrl: this.config.get<string>('notificationServiceUrl')!,
      defaultHeaders: { ...authHeaders, ...this.correlationHeaders() },
    });
  }

  private correlationHeaders(): Record<string, string> {
    const id = getCorrelationId();
    return id ? { 'x-correlation-id': id } : {};
  }

  /**
   * Pure aggregation, no domain logic: user-service owns the profile,
   * notification-service owns the unread count. Fetched in parallel since
   * they're independent reads — unlike order-bff, a profile with either half
   * missing isn't a useful partial result, so either failure surfaces as an
   * error rather than a degraded field.
   */
  async getProfile(email: string, authHeaders: Record<string, string>): Promise<ProfileResponse> {
    try {
      const [user, unread] = await Promise.all([
        this.userClient(authHeaders).getUserByEmail(email),
        this.notificationClient(authHeaders).getUnreadCount(),
      ]);
      return { ...user, unreadNotifications: unread.count };
    } catch (err) {
      if (err instanceof FetchError && err.status === 404) {
        throw new NotFoundException(`User ${email} not found`);
      }
      throw new BadGatewayException('failed to aggregate profile');
    }
  }
}
