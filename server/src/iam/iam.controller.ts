import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { UpdateUserAccessDto } from './dto/update-user-access.dto';
import { IamService } from './iam.service';

@Controller('iam')
@Permissions('iam:manage')
export class IamController {
  constructor(private readonly iamService: IamService) {}

  @Get('users')
  users() {
    return this.iamService.listUsers();
  }

  @Get('permissions')
  permissions() {
    return this.iamService.permissionCatalog();
  }

  @Patch('users/:userId/access')
  updateUserAccess(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserAccessDto,
  ) {
    return this.iamService.updateUserAccess(userId, dto);
  }
}
