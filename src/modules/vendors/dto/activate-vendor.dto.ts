import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class ActivateVendorDto {
  @ApiProperty({
    example: 1,
    description: 'ID of the subscription plan to assign (from /subscription-plans)',
  })
  @IsInt()
  @IsPositive()
  plan_id: number;
}
