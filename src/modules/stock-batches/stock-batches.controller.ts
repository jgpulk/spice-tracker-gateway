import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StockBatchesService } from './stock-batches.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateStockBatchDto } from './dto/create-stock-batch.dto';

@ApiTags('Stock Batches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.VENDOR_OWNER, Role.WAREHOUSE_STAFF)
@Controller('stock-batches')
export class StockBatchesController {
  constructor(private readonly stockBatchesService: StockBatchesService) {}

  @Get()
  @ApiOperation({ summary: 'List all stock batches for this vendor' })
  findAll(@CurrentUser() user: any) {
    return this.stockBatchesService.findAllByVendor(user.vendor_id);
  }

  @Post()
  @ApiOperation({ summary: 'Log a new incoming batch from a farmer (status: RECEIVED)' })
  create(@Body() body: CreateStockBatchDto, @CurrentUser() user: any) {
    return this.stockBatchesService.create({ ...body, vendor_id: user.vendor_id });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a stock batch by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.stockBatchesService.findOne(id, user.vendor_id);
  }
}
