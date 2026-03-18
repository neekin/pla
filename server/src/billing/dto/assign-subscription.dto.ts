import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AssignSubscriptionDto {
  @IsString()
  @MaxLength(50)
  tenantId: string;

  @IsString()
  @MaxLength(40)
  editionId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  trialDays?: number;

  @IsOptional()
  @IsInt()
  @Min(-1)
  @Max(1_000_000)
  quotaTaskDispatchMonthly?: number;
}
