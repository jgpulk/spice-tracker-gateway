import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsPositive } from 'class-validator';
import { Grade } from '../../../common/enums/grade.enum';

export class CreateGradedStockDto {
  @ApiProperty({ example: 1, description: 'ID of the drying lot' })
  @IsInt()
  drying_lot_id: number;

  @ApiProperty({ enum: Grade, example: Grade.GRADE_A })
  @IsEnum(Grade)
  grade: Grade;

  @ApiProperty({ example: 40.0, description: 'Weight in kg for this grade' })
  @IsNumber()
  @IsPositive()
  weight_kg: number;

  @ApiProperty({ example: 1200.00, description: 'Target sell price per kg' })
  @IsNumber()
  @IsPositive()
  price_per_kg: number;
}
