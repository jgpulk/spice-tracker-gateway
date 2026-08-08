import { Controller, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CreateClientDto } from './dto/create-client.dto';

@ApiTags('Clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.VENDOR_OWNER)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'List all clients (buyers)' })
  findAll() {
    return this.clientsService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Add a new client — set type=VENDOR and ref_vendor_id for vendor-to-vendor' })
  create(@Body() body: CreateClientDto) {
    return this.clientsService.create(body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a client by public ID' })
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a client' })
  update(@Param('id') id: string, @Body() body: CreateClientDto) {
    return this.clientsService.update(id, body);
  }
}
