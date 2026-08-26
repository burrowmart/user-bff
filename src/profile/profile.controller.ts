import { Controller, Get, Headers } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { JwtPayload } from 'jsonwebtoken';
import { Claims } from '../common/auth/claims.decorator';
import { forwardAuthHeaders } from '../common/auth/forward-auth-headers.helper';
import { ProfileService } from './profile.service';

@ApiTags('profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly service: ProfileService) {}

  @Get()
  @ApiOkResponse({ description: 'user-service profile + notification-service unread count, aggregated' })
  getProfile(@Claims() claims: JwtPayload, @Headers() headers: Record<string, string>) {
    return this.service.getProfile(claims.email as string, forwardAuthHeaders(headers));
  }
}
