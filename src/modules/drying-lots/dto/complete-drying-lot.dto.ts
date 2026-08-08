import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive } from 'class-validator';

export class CompleteDryingLotDto {
  @ApiProperty({ example: 85.5, description: 'Final dry weight in kg after drying' })
  @IsNumber()
  @IsPositive()
  final_dry_weight_kg: number;
}
