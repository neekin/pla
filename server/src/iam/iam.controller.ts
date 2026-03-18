import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { EntityAudit } from '../common/decorators/entity-audit.decorator';
import type { RequestWithUser } from '../common/types/request-with-user.type';
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

  @EntityAudit({ entityName: 'UserEntity', action: 'update' })
  @Patch('users/:userId/access')
  updateUserAccess(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserAccessDto,
    @Req() request: RequestWithUser,
  ) {
    return this.iamService.updateUserAccess(userId, dto, request.user);
  }
}
