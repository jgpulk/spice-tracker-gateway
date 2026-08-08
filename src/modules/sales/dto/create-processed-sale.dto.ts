import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, IsOptional, IsPositive, IsString, ValidateNested } from 'class-validator';

export class SaleStockItemDto {
  @ApiProperty({ example: 1, description: 'ID of the graded stock item' })
  @IsInt()
  graded_stock_id: number;

  @ApiProperty({ example: 20.0 })
  @IsNumber()
  @IsPositive()
  weight_kg: number;

  @ApiProperty({ example: 1200.00 })
  @IsNumber()
  @IsPositive()
  price_per_kg: number;
}

export class CreateProcessedSaleDto {
  @ApiProperty({ example: 1, description: 'ID of the client' })
  @IsInt()
  client_id: number;

  @ApiProperty({ type: [SaleStockItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleStockItemDto)
  items: SaleStockItemDto[];

  @ApiPropertyOptional({ example: 'Export batch' })
  @IsOptional()
  @IsString()
  notes?: string;
}
