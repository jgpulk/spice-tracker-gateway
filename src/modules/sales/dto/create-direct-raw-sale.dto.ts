import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDirectRawSaleDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', description: 'public_id of the client' })
  @IsUUID()
  @IsNotEmpty()
  client_public_id: string;

  @ApiProperty({ example: ['a1b2c3d4-...', 'e5f6a7b8-...'], type: [String] })
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayNotEmpty()
  batch_public_ids: string[];

  @ApiPropertyOptional({ example: 'Urgent sale' })
  @IsOptional()
  @IsString()
  notes?: string;
}
