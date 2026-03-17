import { IsBoolean, IsString, MinLength } from 'class-validator';

export class CreateFeatureFlagDto {
  @IsString()
  @MinLength(1)
  key!: string;

  @IsBoolean()
  enabled!: boolean;
}
