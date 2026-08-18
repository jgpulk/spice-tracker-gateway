import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Roles(Role.SUPER_ADMIN)
  @Get('super-admin')
  @ResponseMessage('Dashboard stats fetched successfully')
  @ApiOperation({
    summary:
      '✅ Verified — Platform-wide vendor, subscription and revenue statistics for the admin dashboard (Super Admin only)',
  })
  getSuperAdminStats() {
    return this.dashboardService.getSuperAdminStats();
  }
}
