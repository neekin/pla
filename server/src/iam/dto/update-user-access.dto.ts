import { IsArray, IsOptional, IsString } from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class UpdateUserAccessDto {
  @IsOptional()
  @IsArray()
  roles?: Role[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}
