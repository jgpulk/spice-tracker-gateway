import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsPositive } from 'class-validator';

export class CompleteDryingLotDto {
  @ApiProperty({ example: 85.5, description: 'Final dry weight in kg after drying' })
  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  final_dry_weight_kg: number;
}
