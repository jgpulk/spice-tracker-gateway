import { Controller, Get, Post, Body, Param, Patch, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VendorsService } from './vendors.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CreateVendorDto } from './dto/create-vendor.dto';

@ApiTags('Vendors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Roles(Role.SUPER_ADMIN)
  @Get()
  @ApiOperation({ summary: 'List all vendor shops (Super Admin only)' })
  findAll() {
    return this.vendorsService.findAll();
  }

  @Roles(Role.SUPER_ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a new vendor shop (Super Admin only)' })
  create(@Body() body: CreateVendorDto) {
    return this.vendorsService.create(body);
  }

  @Roles(Role.SUPER_ADMIN)
  @Get(':id')
  @ApiOperation({ summary: 'Get a vendor shop by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.vendorsService.findOne(id);
  }

  @Roles(Role.SUPER_ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a vendor shop' })
  update(@Param('id', ParseIntPipe) id: number, @Body() body: CreateVendorDto) {
    return this.vendorsService.update(id, body);
  }
}
