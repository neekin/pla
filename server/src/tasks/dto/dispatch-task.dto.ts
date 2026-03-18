import { IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class DispatchTaskDto {
  @IsString()
  @MaxLength(50)
  taskType: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  runAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  maxRetry?: number;

  @IsOptional()
  @IsIn(['fixed', 'exponential'])
  retryStrategy?: 'fixed' | 'exponential';

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(1800000)
  retryBaseDelayMs?: number;
}
