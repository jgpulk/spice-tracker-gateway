import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateSuperAdminDto } from './dto/create-super-admin.dto';

@ApiTags('Staff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.VENDOR_OWNER)
  @Get()
  @ApiOperation({ summary: 'List all staff for this vendor shop' })
  findAll(@CurrentUser() user: any) {
    return this.usersService.findAllByVendor(user.vendor_id);
  }

  @Roles(Role.VENDOR_OWNER)
  @Post()
  @ApiOperation({ summary: 'Add a new staff member to this vendor shop' })
  create(@Body() body: CreateUserDto, @CurrentUser() user: any) {
    return this.usersService.create({ ...body, vendor_id: user.vendor_id });
  }

  @Roles(Role.SUPER_ADMIN)
  @Post('super-admin')
  @ApiOperation({ summary: 'Create a new super admin (Super Admin only)' })
  createSuperAdmin(@Body() body: CreateSuperAdminDto) {
    return this.usersService.createSuperAdmin(body.name, body.email, body.password);
  }
}
