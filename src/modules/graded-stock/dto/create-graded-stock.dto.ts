import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsPositive, IsUUID } from 'class-validator';
import { Grade } from '../../../common/enums/grade.enum';

export class CreateGradedStockDto {
  @ApiProperty({ example: 'uuid-of-drying-lot' })
  @IsUUID()
  drying_lot_id: string;

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
