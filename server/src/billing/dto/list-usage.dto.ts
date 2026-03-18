import { IsOptional, IsString } from 'class-validator';

export class ListUsageDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  capabilityPoint?: string;
}
