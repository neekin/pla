import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListAlertEventsDto {
  @IsOptional()
  @IsIn(['critical', 'warning', 'info'])
  severity?: 'critical' | 'warning' | 'info';

  @IsOptional()
  @IsIn(['open', 'investigating', 'mitigated', 'resolved'])
  status?: 'open' | 'investigating' | 'mitigated' | 'resolved';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  alertName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ticketId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
