import { Controller, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FarmerPayoutsService } from './farmer-payouts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateFarmerPayoutDto } from './dto/create-farmer-payout.dto';

@ApiTags('Farmer Payouts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.VENDOR_OWNER)
@Controller('farmer-payouts')
export class FarmerPayoutsController {
  constructor(private readonly farmerPayoutsService: FarmerPayoutsService) {}

  @Get()
  @ApiOperation({ summary: 'List all farmer payouts for this vendor' })
  findAll(@CurrentUser() user: any) {
    return this.farmerPayoutsService.findAllByVendor(user.vendor_id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a payout record for a farmer batch' })
  create(@Body() body: CreateFarmerPayoutDto, @CurrentUser() user: any) {
    return this.farmerPayoutsService.create({ ...body, vendor_id: user.vendor_id });
  }

  @Patch(':id/pay')
  @ApiOperation({ summary: 'Mark a payout as PAID' })
  markPaid(@Param('id') id: string, @CurrentUser() user: any) {
    return this.farmerPayoutsService.markPaid(id, user.vendor_id);
  }
}
