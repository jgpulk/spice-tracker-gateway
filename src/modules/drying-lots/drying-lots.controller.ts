import { Controller, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DryingLotsService } from './drying-lots.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { CreateDryingLotDto } from './dto/create-drying-lot.dto';
import { CompleteDryingLotDto } from './dto/complete-drying-lot.dto';

@ApiTags('Drying Lots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.VENDOR_OWNER, Role.WAREHOUSE_STAFF)
@Controller('drying-lots')
export class DryingLotsController {
  constructor(private readonly dryingLotsService: DryingLotsService) {}

  @Get()
  @ResponseMessage('Drying lots fetched successfully')
  @ApiOperation({ summary: 'List all drying lots for this vendor' })
  findAll(@CurrentUser() user: any) {
    return this.dryingLotsService.findAllByVendor(user.vendor_id);
  }

  @Post()
  @ResponseMessage('Drying lot created successfully')
  @ApiOperation({ summary: 'Start a new drying lot and assign batches to it (batches → IN_DRYING)' })
  create(@Body() body: CreateDryingLotDto, @CurrentUser() user: any) {
    return this.dryingLotsService.create(user.vendor_id, body.lot_name, body.batch_public_ids);
  }

  @Get(':id')
  @ResponseMessage('Drying lot fetched successfully')
  @ApiOperation({ summary: 'Get a drying lot by public ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.dryingLotsService.findOne(id, user.vendor_id);
  }

  @Patch(':id/complete')
  @ResponseMessage('Drying lot completed successfully')
  @ApiOperation({
    summary: 'Complete a drying lot — enter final dry weight, calculates yield % (batches → PROCESSED)',
  })
  complete(@Param('id') id: string, @Body() body: CompleteDryingLotDto, @CurrentUser() user: any) {
    return this.dryingLotsService.complete(id, user.vendor_id, body.final_dry_weight_kg);
  }
}
