import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsString } from 'class-validator';

export class CreateDryingLotDto {
  @ApiProperty({ example: 'LOT-2024-01' })
  @IsString()
  lot_name: string;

  @ApiProperty({ example: [1, 2], type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  batch_ids: number[];
}
