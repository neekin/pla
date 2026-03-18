import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class RenewSubscriptionDto {
  @IsString()
  @MaxLength(50)
  tenantId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36)
  months?: number;
}
