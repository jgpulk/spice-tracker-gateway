import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SubscriptionPlansService } from './subscription-plans.service';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';

@ApiTags('Subscription Plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('subscription-plans')
export class SubscriptionPlansController {
  constructor(private readonly plansService: SubscriptionPlansService) {}

  @Roles(Role.SUPER_ADMIN)
  @Get()
  @ResponseMessage('Subscription plans fetched successfully')
  @ApiOperation({ summary: '✅ Verified — List all subscription plans (Super Admin only)' })
  findAll() {
    return this.plansService.findAll();
  }

  @Roles(Role.SUPER_ADMIN)
  @Get(':id')
  @ResponseMessage('Subscription plan fetched successfully')
  @ApiOperation({ summary: 'Get a subscription plan by public ID (Super Admin only)' })
  findOne(@Param('id') id: string) {
    return this.plansService.findOne(id);
  }

  @Roles(Role.SUPER_ADMIN)
  @Post()
  @ResponseMessage('Subscription plan created successfully')
  @ApiOperation({ summary: '✅ Verified — Create a new subscription plan (Super Admin only)' })
  async create(@Body() dto: CreateSubscriptionPlanDto) {
    await this.plansService.create(dto);
  }

  @Roles(Role.SUPER_ADMIN)
  @Patch(':id')
  @ResponseMessage('Subscription plan updated successfully')
  @ApiOperation({ summary: '✅ Verified — Update a subscription plan (Super Admin only)' })
  async update(@Param('id') id: string, @Body() dto: UpdateSubscriptionPlanDto) {
    await this.plansService.update(id, dto);
  }
}
