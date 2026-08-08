import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
} from 'class-validator';

export class CreateFarmerPayoutDto {
  @ApiProperty({ example: 'uuid-of-farmer' })
  @IsUUID()
  farmer_id!: string;

  @ApiProperty({ example: 'uuid-of-batch' })
  @IsUUID()
  batch_id!: string;

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
