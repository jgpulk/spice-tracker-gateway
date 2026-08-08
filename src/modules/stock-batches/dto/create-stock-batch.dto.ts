import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateStockBatchDto {
  @ApiProperty({ example: 1, description: 'ID of the farmer' })
  @IsInt()
  farmer_id: number;

  @ApiProperty({ example: 120.5, description: 'Raw weight in kg' })
  @IsNumber()
  @IsPositive()
  raw_weight_kg: number;

  @ApiProperty({ example: 850.00, description: 'Purchase price per kg' })
  @IsNumber()
  @IsPositive()
  price_per_kg: number;

  @ApiPropertyOptional({ example: 'Green, good quality' })
  @IsOptional()
  @IsString()
  notes?: string;
}
