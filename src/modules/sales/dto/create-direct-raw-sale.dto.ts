import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDirectRawSaleDto {
  @ApiProperty({ example: 'uuid-of-client' })
  @IsUUID()
  client_id: string;

  @ApiProperty({ example: ['uuid-batch-1', 'uuid-batch-2'], type: [String] })
  @IsArray()
  @IsUUID('all', { each: true })
  batch_ids: string[];

  @ApiPropertyOptional({ example: 'Urgent sale' })
  @IsOptional()
  @IsString()
  notes?: string;
}
