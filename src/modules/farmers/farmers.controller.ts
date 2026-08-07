import { Controller, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { FarmersService } from './farmers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.VENDOR_OWNER)
@Controller('farmers')
export class FarmersController {
  constructor(private readonly farmersService: FarmersService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.farmersService.findAllByVendor(user.vendor_id);
  }

  @Post()
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.farmersService.create({ ...body, vendor_id: user.vendor_id });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.farmersService.findOne(id, user.vendor_id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return this.farmersService.update(id, user.vendor_id, body);
  }
}
