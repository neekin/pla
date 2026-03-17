import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class RemovePlatformSettingDto {
  @IsIn(['host', 'tenant', 'user'])
  scopeType!: 'host' | 'tenant' | 'user';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  scopeId?: string;
}
