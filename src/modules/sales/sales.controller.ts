import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { CreateDirectRawSaleDto } from './dto/create-direct-raw-sale.dto';
import { CreateProcessedSaleDto } from './dto/create-processed-sale.dto';

@ApiTags('Sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.VENDOR_OWNER)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @ResponseMessage('Sales fetched successfully')
  @ApiOperation({ summary: 'List all sales for this vendor' })
  findAll(@CurrentUser() user: any) {
    return this.salesService.findAllByVendor(user.vendor_id);
  }

  @Post('direct-raw')
  @ResponseMessage('Sale recorded successfully')
  @ApiOperation({ summary: 'Workflow A — Sell raw batches directly to a client (batches → SOLD_RAW)' })
  sellRaw(@Body() body: CreateDirectRawSaleDto, @CurrentUser() user: any) {
    return this.salesService.createDirectRawSale(
      user.vendor_id,
      body.client_public_id,
      body.batch_public_ids,
      body.notes,
    );
  }

  @Post('processed')
  @ResponseMessage('Sale recorded successfully')
  @ApiOperation({ summary: 'Workflow B — Sell processed graded stock to a client' })
  sellProcessed(@Body() body: CreateProcessedSaleDto, @CurrentUser() user: any) {
    return this.salesService.createProcessedSale(
      user.vendor_id,
      body.client_public_id,
      body.items,
      body.notes,
    );
  }
}
