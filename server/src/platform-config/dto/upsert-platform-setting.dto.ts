import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertPlatformSettingDto {
  @IsIn(['host', 'tenant', 'user'])
  scopeType!: 'host' | 'tenant' | 'user';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  scopeId?: string;

  value!: unknown;
}
