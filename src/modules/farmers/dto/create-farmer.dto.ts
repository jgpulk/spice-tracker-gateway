import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { trim } from '../../../common/transforms/string.transform';

export class CreateFarmerDto {
  @ApiProperty({ example: 'Rajan Kumar' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  @IsNotEmpty()
  @Transform(trim)
  name: string;

  @ApiProperty({ example: '+919876543210', description: 'Valid phone number with optional + country code' })
  @Matches(/^\+?[0-9]{7,15}$/, {
    message: 'phone must contain only digits with an optional leading + (e.g. +919876543210)',
  })
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ example: 'Idukki, Kerala' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(trim)
  location?: string;

  @ApiPropertyOptional({ example: 'SB1234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trim)
  bank_account?: string;
}
