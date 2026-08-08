import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { VendorsService } from './vendors.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
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
  @ApiOperation({ summary: 'List all vendor shops with subscription history (Super Admin only)' })
  findAll() {
    return this.vendorsService.findAll();
  }

  @Roles(Role.SUPER_ADMIN)
  @Post()
  @ApiOperation({
    summary: 'Onboard a new vendor — starts a 30-day trial automatically (Super Admin only)',
  })
  create(@Body() body: CreateVendorDto, @CurrentUser() user: any) {
    return this.vendorsService.create(body, user.id_user);
  }

  @Roles(Role.SUPER_ADMIN)
  @Get(':id')
  @ApiOperation({ summary: 'Get a vendor with full subscription history (Super Admin only)' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.vendorsService.findOne(id);
  }

  @Roles(Role.SUPER_ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update vendor details (Super Admin only)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() body: CreateVendorDto) {
    return this.vendorsService.update(id, body);
  }

  @Roles(Role.SUPER_ADMIN)
  @Patch(':id/activate')
  @ApiOperation({
    summary:
      'Activate a vendor onto a paid plan (works for TRIAL → ACTIVE and SUSPENDED → ACTIVE). Super Admin only.',
  })
  activate(@Param('id', ParseIntPipe) id: number, @Body() body: ActivateVendorDto) {
    return this.vendorsService.activateVendor(id, body.plan_id);
  }
}
