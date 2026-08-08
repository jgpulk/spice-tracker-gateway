import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class CreateStockBatchDto {
  @ApiProperty({ example: 'uuid-of-farmer' })
  @IsUUID()
  farmer_id: string;

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
