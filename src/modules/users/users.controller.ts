import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.VENDOR_OWNER)
  @Get()
  findAll(@CurrentUser() user: any) {
    return this.usersService.findAllByVendor(user.vendor_id);
  }

  @Roles(Role.VENDOR_OWNER)
  @Post()
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.usersService.create({ ...body, vendor_id: user.vendor_id });
  }
}
