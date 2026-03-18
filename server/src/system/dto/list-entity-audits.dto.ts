import { IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListEntityAuditsDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  entityName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  actorUsername?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsIn(['create', 'update', 'delete'])
  action?: 'create' | 'update' | 'delete';
}
