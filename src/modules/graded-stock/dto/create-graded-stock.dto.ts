import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsPositive, IsUUID } from 'class-validator';
import { Grade } from '../../../common/enums/grade.enum';

export class CreateGradedStockDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', description: 'public_id of the drying lot' })
  @IsUUID()
  @IsNotEmpty()
  drying_lot_public_id: string;

  @ApiProperty({ enum: Grade, example: Grade.GRADE_A })
  @IsEnum(Grade)
  @IsNotEmpty()
  grade: Grade;

  @ApiProperty({ example: 40.0, description: 'Weight in kg for this grade' })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  weight_kg: number;

  @ApiProperty({ example: 1200.0, description: 'Target sell price per kg' })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  price_per_kg: number;
}
