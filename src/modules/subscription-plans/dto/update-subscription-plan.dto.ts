import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateSubscriptionPlanDto } from './create-subscription-plan.dto';

export class UpdateSubscriptionPlanDto extends CreateSubscriptionPlanDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Mark this plan as the default trial plan. Only one plan can hold this flag at a time.',
  })
  @IsBoolean()
  @IsOptional()
  is_default_trial?: boolean;
}
