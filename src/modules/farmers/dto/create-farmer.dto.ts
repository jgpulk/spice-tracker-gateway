import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFarmerDto {
  @ApiProperty({ example: 'Rajan Kumar' })
  @IsString()
  name: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @MaxLength(50)
  phone: string;

  @ApiPropertyOptional({ example: 'Idukki, Kerala' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 'SB1234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bank_account?: string;
}
