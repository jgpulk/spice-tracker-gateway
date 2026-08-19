import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateDryingLotDto {
  @ApiProperty({ example: 'LOT-2024-01' })
  @IsString()
  @MaxLength(100)
  @IsNotEmpty()
  lot_name: string;

  @ApiProperty({ example: ['a1b2c3d4-...', 'e5f6a7b8-...'], type: [String] })
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayNotEmpty()
  batch_public_ids: string[];
}
