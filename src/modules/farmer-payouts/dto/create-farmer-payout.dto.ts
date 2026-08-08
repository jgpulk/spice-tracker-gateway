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
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'public_id of the farmer',
  })
  @IsUUID()
  farmer_public_id!: string;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'public_id of the stock batch',
  })
  @IsUUID()
  batch_public_id!: string;

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
