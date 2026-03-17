import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListPlatformSettingsDto {
  @IsOptional()
  @IsIn(['effective', 'host', 'tenant', 'user'])
  scope?: 'effective' | 'host' | 'tenant' | 'user';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  tenantId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  scopeId?: string;
}
