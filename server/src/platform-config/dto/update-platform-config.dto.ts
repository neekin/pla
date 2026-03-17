import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class UpdatePlatformConfigDto {
  @IsOptional()
  @IsObject()
  featureFlags?: Record<string, boolean>;

  @IsOptional()
  @IsBoolean()
  taskQueuePersistenceEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  taskQueueRunnerEnabled?: boolean;
}
