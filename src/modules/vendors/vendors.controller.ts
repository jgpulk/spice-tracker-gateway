import { Controller, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VendorsService } from './vendors.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { ActivateVendorDto } from './dto/activate-vendor.dto';

@ApiTags('Vendors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Roles(Role.SUPER_ADMIN)
  @Get()
  @ResponseMessage('Vendors fetched successfully')
  @ApiOperation({
    summary: '✅ Verified — List all vendor shops with subscription history (Super Admin only)',
  })
  findAll() {
    return this.vendorsService.findAll();
  }

  @Roles(Role.SUPER_ADMIN)
  @Post()
  @ResponseMessage('Vendor onboarded successfully')
  @ApiOperation({
    summary:
      '✅ Verified — Onboard a new vendor — starts a 30-day trial automatically (Super Admin only)',
  })
  async create(@Body() body: CreateVendorDto, @CurrentUser() user: any) {
    await this.vendorsService.create(body, user.id_user);
  }

  @Roles(Role.SUPER_ADMIN)
  @Get(':id')
  @ResponseMessage('Vendor fetched successfully')
  @ApiOperation({ summary: 'Get a vendor with full subscription history (Super Admin only)' })
  findOne(@Param('id') id: string) {
    return this.vendorsService.findOne(id);
  }

  @Roles(Role.SUPER_ADMIN)
  @Patch(':id')
  @ResponseMessage('Vendor updated successfully')
  @ApiOperation({ summary: 'Update vendor details (Super Admin only)' })
  update(@Param('id') id: string, @Body() body: CreateVendorDto) {
    return this.vendorsService.update(id, body);
  }

  @Roles(Role.SUPER_ADMIN)
  @Patch(':id/activate')
  @ResponseMessage('Vendor activated successfully')
  @ApiOperation({
    summary:
      'Activate a vendor onto a paid plan (works for TRIAL → ACTIVE and SUSPENDED → ACTIVE). Super Admin only.',
  })
  activate(@Param('id') id: string, @Body() body: ActivateVendorDto) {
    return this.vendorsService.activateVendor(id, body.plan_public_id);
  }
}
