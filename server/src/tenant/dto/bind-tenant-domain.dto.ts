import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class BindTenantDomainDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  tenantId: string;

  @IsString()
  @MaxLength(255)
  @Matches(/^[a-z0-9.-]+$/i)
  domain: string;
}
