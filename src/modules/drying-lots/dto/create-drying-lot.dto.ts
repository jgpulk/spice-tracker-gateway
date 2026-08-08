import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, IsUUID } from 'class-validator';

export class CreateDryingLotDto {
  @ApiProperty({ example: 'LOT-2024-01' })
  @IsString()
  lot_name: string;

  @ApiProperty({ example: ['uuid-batch-1', 'uuid-batch-2'], type: [String] })
  @IsArray()
  @IsUUID('all', { each: true })
  batch_ids: string[];
}
