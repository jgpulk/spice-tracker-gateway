import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsPositive, IsString, IsUUID, ValidateNested } from 'class-validator';

export class SaleStockItemDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', description: 'public_id of the graded stock item' })
  @IsUUID()
  graded_stock_public_id: string;

  @ApiProperty({ example: 20.0 })
  @IsNumber()
  @IsPositive()
  weight_kg: number;

  @ApiProperty({ example: 1200.0 })
  @IsNumber()
  @IsPositive()
  price_per_kg: number;
}

export class CreateProcessedSaleDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', description: 'public_id of the client' })
  @IsUUID()
  client_public_id: string;

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
