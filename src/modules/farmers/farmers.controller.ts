import { Controller, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FarmersService } from './farmers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateFarmerDto } from './dto/create-farmer.dto';

@ApiTags('Farmers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.VENDOR_OWNER)
@Controller('farmers')
export class FarmersController {
  constructor(private readonly farmersService: FarmersService) {}

  @Get()
  @ApiOperation({ summary: 'List all farmers for this vendor' })
  findAll(@CurrentUser() user: any) {
    return this.farmersService.findAllByVendor(user.vendor_id);
  }

  @Post()
  @ApiOperation({ summary: 'Add a new farmer (raw supplier)' })
  create(@Body() body: CreateFarmerDto, @CurrentUser() user: any) {
    return this.farmersService.create({ ...body, vendor_id: user.vendor_id });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a farmer by public ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.farmersService.findOne(id, user.vendor_id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a farmer' })
  update(@Param('id') id: string, @Body() body: CreateFarmerDto, @CurrentUser() user: any) {
    return this.farmersService.update(id, user.vendor_id, body);
  }
}
