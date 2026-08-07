import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { StockBatchesService } from './stock-batches.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.VENDOR_OWNER, Role.WAREHOUSE_STAFF)
@Controller('stock-batches')
export class StockBatchesController {
  constructor(private readonly stockBatchesService: StockBatchesService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.stockBatchesService.findAllByVendor(user.vendor_id);
  }

  @Post()
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.stockBatchesService.create({ ...body, vendor_id: user.vendor_id });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.stockBatchesService.findOne(id, user.vendor_id);
  }
}
