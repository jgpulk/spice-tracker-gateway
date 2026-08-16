import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { CreateUserDto } from './dto/create-user.dto';

@ApiTags('Staff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('staff')
export class StaffController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.VENDOR_OWNER)
  @Get()
  @ResponseMessage('Staff list fetched successfully')
  @ApiOperation({ summary: '✅ Verified — List all staff for this vendor shop' })
  findAll(@CurrentUser() user: any) {
    return this.usersService.findAllByVendor(user.vendor_id);
  }

  @Roles(Role.VENDOR_OWNER)
  @Post()
  @ResponseMessage('Staff member created successfully')
  @ApiOperation({ summary: '✅ Verified — Add a new staff member to this vendor shop' })
  async create(@Body() body: CreateUserDto, @CurrentUser() user: any) {
    await this.usersService.createStaff(body.name, body.email, body.password, user.vendor_id);
  }
}
