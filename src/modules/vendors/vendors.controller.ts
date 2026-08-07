import { Controller, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Roles(Role.SUPER_ADMIN)
  @Get()
  findAll() {
    return this.vendorsService.findAll();
  }

  @Roles(Role.SUPER_ADMIN)
  @Post()
  create(@Body() body: any) {
    return this.vendorsService.create(body);
  }

  @Roles(Role.SUPER_ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vendorsService.findOne(id);
  }

  @Roles(Role.SUPER_ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.vendorsService.update(id, body);
  }
}
