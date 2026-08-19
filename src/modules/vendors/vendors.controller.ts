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
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto';
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
    summary:
      '✅ Verified — List all vendor shops with subscription history (Super Admin only)',
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

  @Roles(Role.VENDOR_OWNER)
  @Patch('me')
  @ResponseMessage('Vendor profile updated successfully')
  @ApiOperation({ summary: '✅ Verified — Update own vendor profile (Vendor Owner only)' })
  async updateMyProfile(@Body() body: UpdateVendorProfileDto, @CurrentUser() user: any) {
    await this.vendorsService.updateProfile(user.vendor_id, body);
  }

  @Roles(Role.SUPER_ADMIN, Role.VENDOR_OWNER)
  @Get(':id')
  @ResponseMessage('Vendor fetched successfully')
  @ApiOperation({
    summary:
      "✅ Verified — Get a vendor with full subscription history (Super Admin can view any vendor by id; Vendor Owner can view only their own — pass 'me' instead of an id)",
  })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.vendorsService.findOne(id, { role: user.role, vendor_id: user.vendor_id });
  }

  @Roles(Role.SUPER_ADMIN)
  @Patch(':id')
  @ResponseMessage('Vendor updated successfully')
  @ApiOperation({ summary: '✅ Verified — Update vendor details (Super Admin only)' })
  async update(@Param('id') id: string, @Body() body: UpdateVendorDto) {
    await this.vendorsService.update(id, body);
  }

  @Roles(Role.SUPER_ADMIN)
  @Patch(':id/activate')
  @ResponseMessage('Vendor activated successfully')
  @ApiOperation({
    summary:
      '✅ Verified — Activate a vendor onto a paid plan (works for TRIAL → ACTIVE and SUSPENDED → ACTIVE). Super Admin only.',
  })
  async activate(@Param('id') id: string, @Body() body: ActivateVendorDto) {
    await this.vendorsService.activateVendor(id, body.plan_id);
  }
}
