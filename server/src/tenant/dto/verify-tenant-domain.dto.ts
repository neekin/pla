import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class VerifyTenantDomainDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  tenantId: string;

  @IsString()
  @MaxLength(255)
  @Matches(/^[a-z0-9.-]+$/i)
  domain: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  token: string;
}
