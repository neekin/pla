import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

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
}
