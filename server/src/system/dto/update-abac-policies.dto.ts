import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AbacRuleDto {
  @IsString()
  @MaxLength(120)
  key: string;

  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedRoles?: string[];

  @IsOptional()
  @IsBoolean()
  requireTenantMatch?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  resourceTenantPath?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  maskedFields?: string[];
}

export class UpdateAbacPoliciesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AbacRuleDto)
  rules: AbacRuleDto[];
}
