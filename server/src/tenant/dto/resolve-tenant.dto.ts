import { IsString, Matches, MaxLength } from 'class-validator';

export class ResolveTenantDto {
  @IsString()
  @MaxLength(255)
  @Matches(/^[a-z0-9.:-]+$/i)
  host: string;
}
