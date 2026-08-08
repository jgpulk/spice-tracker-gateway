import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator';

export class SaleStockItemDto {
  @ApiProperty({ example: 'uuid-of-graded-stock' })
  @IsUUID()
  graded_stock_id: string;

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
  @ApiProperty({ example: 'uuid-of-client' })
  @IsUUID()
  client_id: string;

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
