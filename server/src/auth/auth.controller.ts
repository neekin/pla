import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { RequestWithUser } from '../common/types/request-with-user.type';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SelfServiceResetPasswordDto } from './dto/self-service-reset-password.dto';
import { AuthService, SecurityPolicy } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() request: RequestWithUser) {
    const ip = (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      ?? request.socket?.remoteAddress
      ?? undefined;
    return this.authService.login(dto, request.tenantId ?? 'host', ip);
  }

  @Get('profile')
  profile(@Req() request: RequestWithUser) {
    return this.authService.profile(request.user!);
  }

  @Permissions('config:read')
  @Get('security-policy')
  getSecurityPolicy() {
    return this.authService.getSecurityPolicy();
  }

  @Permissions('config:write')
  @Patch('security-policy')
  updateSecurityPolicy(@Body() patch: Partial<SecurityPolicy>, @Req() request: RequestWithUser) {
    return this.authService.updateSecurityPolicy(patch, request.user?.userId ?? 'system');
  }

  @Post('password-reset')
  resetPassword(@Body() dto: ResetPasswordDto, @Req() request: RequestWithUser) {
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
