import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.VENDOR_OWNER)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.salesService.findAllByVendor(user.vendor_id);
  }

  @Post('direct-raw')
  sellRaw(@Body() body: any, @CurrentUser() user: any) {
    return this.salesService.createDirectRawSale(user.vendor_id, body.client_id, body.batch_ids, body.notes);
  }

  @Post('processed')
  sellProcessed(@Body() body: any, @CurrentUser() user: any) {
    return this.salesService.createProcessedSale(user.vendor_id, body.client_id, body.items, body.notes);
  }
}
