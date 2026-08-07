import { Controller, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { DryingLotsService } from './drying-lots.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.VENDOR_OWNER, Role.WAREHOUSE_STAFF)
@Controller('drying-lots')
export class DryingLotsController {
  constructor(private readonly dryingLotsService: DryingLotsService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.dryingLotsService.findAllByVendor(user.vendor_id);
  }

  @Post()
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.dryingLotsService.create(user.vendor_id, body.lot_name, body.batch_ids);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.dryingLotsService.findOne(id, user.vendor_id);
  }

  @Patch(':id/complete')
  complete(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return this.dryingLotsService.complete(id, user.vendor_id, body.final_dry_weight_kg);
  }
}
