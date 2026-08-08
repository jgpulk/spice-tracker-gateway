import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ClientType } from '../../../common/enums/client-type.enum';

export class CreateClientDto {
  @ApiProperty({ example: 'Spice Traders Ltd' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({ example: '+919876543210', description: 'Valid phone number with optional + country code' })
  @Matches(/^\+?[0-9]{7,15}$/, {
    message: 'phone must contain only digits with an optional leading + (e.g. +919876543210)',
  })
  phone: string;

  @ApiPropertyOptional({ example: 'trader@example.com' })
  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => value?.trim().toLowerCase())
  email?: string;

  @ApiPropertyOptional({ example: 'Spice Traders Ltd' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  company_name?: string;

  @ApiPropertyOptional({ example: 'Cochin, Kerala' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  address?: string;

  @ApiProperty({ enum: ClientType, default: ClientType.INDIVIDUAL })
  @IsEnum(ClientType)
  type: ClientType;

  @ApiPropertyOptional({
    example: 1,
    description: 'Only when type is VENDOR — internal ID of the vendor',
  })
  @IsOptional()
  @IsInt()
  ref_vendor_id?: number;
}
