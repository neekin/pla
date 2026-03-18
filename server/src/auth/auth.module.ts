import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthLoginAttemptEntity } from '../database/entities/auth-login-attempt.entity';
import { AuthSecurityPolicyEntity } from '../database/entities/auth-security-policy.entity';
import { UserEntity } from '../database/entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, AuthLoginAttemptEntity, AuthSecurityPolicyEntity])],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
