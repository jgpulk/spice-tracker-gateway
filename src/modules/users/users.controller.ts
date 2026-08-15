import { Controller, Post, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { CreateSuperAdminDto } from './dto/create-super-admin.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.SUPER_ADMIN)
  @Post('super-admin')
  @ResponseMessage('Super admin created successfully')
  @ApiOperation({ summary: '✅ Verified — Create a new super admin (Super Admin only)' })
  async createSuperAdmin(@Body() body: CreateSuperAdminDto) {
    await this.usersService.createSuperAdmin(body.name, body.email, body.password);
    // no return — response will be { status: true, message: "..." } with no data field
  }

  @Patch('me/password')
  @ResponseMessage('Password updated successfully')
  @ApiOperation({ summary: '✅ Verified — Change your own password' })
  async changeMyPassword(@Body() body: ChangePasswordDto, @CurrentUser() user: any) {
    await this.usersService.changePassword(user.id_user, body.current_password, body.new_password);
  }
}
