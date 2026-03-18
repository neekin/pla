import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ReportUsageDto {
  @IsString()
  @MaxLength(50)
  tenantId: string;

  @IsString()
  @MaxLength(80)
  capabilityPoint: string;

  @IsInt()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  periodStart?: string;
}
