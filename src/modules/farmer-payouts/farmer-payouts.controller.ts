import { Controller, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { FarmerPayoutsService } from './farmer-payouts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.VENDOR_OWNER)
@Controller('farmer-payouts')
export class FarmerPayoutsController {
  constructor(private readonly farmerPayoutsService: FarmerPayoutsService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.farmerPayoutsService.findAllByVendor(user.vendor_id);
  }

  @Post()
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.farmerPayoutsService.create({ ...body, vendor_id: user.vendor_id });
  }

  @Patch(':id/pay')
  markPaid(@Param('id') id: string, @CurrentUser() user: any) {
    return this.farmerPayoutsService.markPaid(id, user.vendor_id);
  }
}
