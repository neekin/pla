import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { RequestWithUser } from '../common/types/request-with-user.type';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SelfServiceResetPasswordDto } from './dto/self-service-reset-password.dto';
import { AuthService, SecurityPolicy } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: Pick<
      AuthService,
      | 'login'
      | 'refreshTokens'
      | 'revokeRefreshToken'
      | 'profile'
      | 'listSessions'
      | 'revokeSessionById'
      | 'getSecurityPolicy'
      | 'updateSecurityPolicy'
      | 'resetPassword'
      | 'resetPasswordByCredentials'
    >,
  ) {}

  private getClientIp(request: RequestWithUser): string | undefined {
    const forwardedForHeader = request.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwardedForHeader)
      ? forwardedForHeader[0]
      : forwardedForHeader;

    return (
      forwardedIp?.split(',')[0]?.trim() ||
      request.socket?.remoteAddress ||
      undefined
    );
  }

  private getUserAgent(request: RequestWithUser): string | undefined {
    const userAgentHeader = request.headers['user-agent'] as
      | string
      | string[]
      | undefined;
    return Array.isArray(userAgentHeader)
      ? userAgentHeader[0]
      : userAgentHeader;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() request: RequestWithUser) {
    return this.authService.login(dto, request.tenantId ?? 'host', {
      ipAddress: this.getClientIp(request),
      userAgent: this.getUserAgent(request),
    });
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto, @Req() request: RequestWithUser) {
    return this.authService.refreshTokens(
      dto.refreshToken,
      request.tenantId ?? 'host',
      {
        ipAddress: this.getClientIp(request),
        userAgent: this.getUserAgent(request),
      },
    );
  }

  @Public()
  @Post('logout')
  logout(@Body() dto: LogoutDto, @Req() request: RequestWithUser) {
    return this.authService.revokeRefreshToken(
      dto.refreshToken,
      request.tenantId ?? 'host',
    );
  }

  @Get('profile')
  profile(@Req() request: RequestWithUser) {
    return this.authService.profile(request.user!);
  }

  @Get('sessions')
  async sessions(
    @Req() request: RequestWithUser,
  ): Promise<Awaited<ReturnType<AuthService['listSessions']>>> {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('UNAUTHORIZED');
    }

    return await this.authService.listSessions(user.userId, user.tenantId);
  }

  @Delete('sessions/:id')
  async revokeSession(
    @Param('id') id: string,
    @Req() request: RequestWithUser,
  ): Promise<Awaited<ReturnType<AuthService['revokeSessionById']>>> {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('UNAUTHORIZED');
    }

    return await this.authService.revokeSessionById(
      id,
      user.userId,
      user.tenantId,
    );
  }

  @Permissions('config:read')
  @Get('security-policy')
  getSecurityPolicy() {
    return this.authService.getSecurityPolicy();
  }

  @Permissions('config:write')
  @Patch('security-policy')
  updateSecurityPolicy(
    @Body() patch: Partial<SecurityPolicy>,
    @Req() request: RequestWithUser,
  ) {
    return this.authService.updateSecurityPolicy(
      patch,
      request.user?.userId ?? 'system',
    );
  }

  @Post('password-reset')
  resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() request: RequestWithUser,
  ) {
    return this.authService.resetPassword(
      request.user!.userId,
      request.user!.tenantId,
      dto.newPassword,
    );
  }

  @Public()
  @Post('password-reset/self-service')
  resetPasswordByCredentials(
    @Body() dto: SelfServiceResetPasswordDto,
    @Req() request: RequestWithUser,
  ) {
    return this.authService.resetPasswordByCredentials({
      tenantId: request.tenantId ?? 'host',
      username: dto.username,
      currentPassword: dto.currentPassword,
      newPassword: dto.newPassword,
    });
  }
}
