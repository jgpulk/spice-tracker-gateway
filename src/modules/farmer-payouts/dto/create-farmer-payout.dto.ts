import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
} from 'class-validator';

export class CreateFarmerPayoutDto {
  @ApiProperty({ example: 1, description: 'ID of the farmer' })
  @IsInt()
  farmer_id!: number;

  @ApiProperty({ example: 1, description: 'ID of the stock batch' })
  @IsInt()
  batch_id!: number;

  @ApiProperty({ example: 102250.0, description: 'Amount to pay the farmer' })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({ example: '2024-12-31' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  due_date?: Date;
}
