import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { ClientType } from '../../../common/enums/client-type.enum';

export class CreateClientDto {
  @ApiProperty({ example: 'Spice Traders Ltd' })
  @IsString()
  name: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @MaxLength(50)
  phone: string;

  @ApiPropertyOptional({ example: 'trader@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'Spice Traders Ltd' })
  @IsOptional()
  @IsString()
  company_name?: string;

  @ApiPropertyOptional({ example: 'Cochin, Kerala' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ enum: ClientType, default: ClientType.INDIVIDUAL })
  @IsEnum(ClientType)
  type: ClientType;

  @ApiPropertyOptional({ example: 1, description: 'Only when type is VENDOR — ID of the vendor' })
  @IsOptional()
  @IsInt()
  ref_vendor_id?: number;
}
