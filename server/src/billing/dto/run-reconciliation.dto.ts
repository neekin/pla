import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class RunReconciliationDto {
  @IsString()
  @MaxLength(50)
  tenantId: string;

  @IsOptional()
  @IsISO8601()
  periodStart?: string;
}