import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { GradedStockService } from './graded-stock.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.VENDOR_OWNER, Role.WAREHOUSE_STAFF)
@Controller('graded-stock')
export class GradedStockController {
  constructor(private readonly gradedStockService: GradedStockService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.gradedStockService.findAllByVendor(user.vendor_id);
  }

  @Post()
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.gradedStockService.create({ ...body, vendor_id: user.vendor_id });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.gradedStockService.findOne(id, user.vendor_id);
  }
}
