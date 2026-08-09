import { Controller, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { CreateClientDto } from './dto/create-client.dto';

@ApiTags('Clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.VENDOR_OWNER)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ResponseMessage('Clients fetched successfully')
  @ApiOperation({ summary: 'List all clients (buyers)' })
  findAll() {
    return this.clientsService.findAll();
  }

  @Post()
  @ResponseMessage('Client created successfully')
  @ApiOperation({ summary: 'Add a new client — set type=VENDOR and ref_vendor_id for vendor-to-vendor' })
  create(@Body() body: CreateClientDto) {
    return this.clientsService.create(body);
  }

  @Get(':id')
  @ResponseMessage('Client fetched successfully')
  @ApiOperation({ summary: 'Get a client by public ID' })
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Patch(':id')
  @ResponseMessage('Client updated successfully')
  @ApiOperation({ summary: 'Update a client' })
  update(@Param('id') id: string, @Body() body: CreateClientDto) {
    return this.clientsService.update(id, body);
  }
}
