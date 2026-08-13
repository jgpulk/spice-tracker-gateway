import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class ActivateVendorDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'public_id of the subscription plan to assign (from /subscription-plans)',
  })
  @IsUUID()
  @IsNotEmpty()
  plan_public_id: string;
}
