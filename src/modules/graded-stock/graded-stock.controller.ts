import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GradedStockService } from './graded-stock.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { CreateGradedStockDto } from './dto/create-graded-stock.dto';

@ApiTags('Graded Stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.VENDOR_OWNER, Role.WAREHOUSE_STAFF)
@Controller('graded-stock')
export class GradedStockController {
  constructor(private readonly gradedStockService: GradedStockService) {}

  @Get()
  @ResponseMessage('Graded stock fetched successfully')
  @ApiOperation({ summary: 'List all graded stock for this vendor' })
  findAll(@CurrentUser() user: any) {
    return this.gradedStockService.findAllByVendor(user.vendor_id);
  }

  @Post()
  @ResponseMessage('Graded stock created successfully')
  @ApiOperation({ summary: 'Record graded stock from a completed drying lot' })
  create(@Body() body: CreateGradedStockDto, @CurrentUser() user: any) {
    return this.gradedStockService.create({ ...body, vendor_id: user.vendor_id });
  }

  @Get(':id')
  @ResponseMessage('Graded stock fetched successfully')
  @ApiOperation({ summary: 'Get a graded stock entry by public ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.gradedStockService.findOne(id, user.vendor_id);
  }
}
