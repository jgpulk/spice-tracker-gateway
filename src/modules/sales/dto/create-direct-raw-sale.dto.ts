import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateDirectRawSaleDto {
  @ApiProperty({ example: 1, description: 'ID of the client' })
  @IsInt()
  client_id: number;

  @ApiProperty({ example: [1, 2], type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  batch_ids: number[];

  @ApiPropertyOptional({ example: 'Urgent sale' })
  @IsOptional()
  @IsString()
  notes?: string;
}
