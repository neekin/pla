import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class RunWorkflowDto {
  @IsString()
  @MaxLength(120)
  workflowKey: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
