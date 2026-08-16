import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class CreateStockBatchDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', description: 'public_id of the farmer' })
  @IsUUID()
  @IsNotEmpty()
  farmer_public_id: string;

  @ApiProperty({ example: 120.5, description: 'Raw weight in kg' })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  raw_weight_kg: number;

  @ApiProperty({ example: 850.0, description: 'Purchase price per kg' })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  price_per_kg: number;

  @ApiPropertyOptional({ example: 'Green, good quality' })
  @IsOptional()
  @IsString()
  notes?: string;
}
