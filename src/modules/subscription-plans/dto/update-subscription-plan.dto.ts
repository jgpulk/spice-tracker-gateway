import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PlanType } from '../entities/subscription-plan.entity';

export class UpdateSubscriptionPlanDto {
  @ApiProperty({ example: 'Starter Monthly' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: PlanType, example: PlanType.STARTER })
  @IsEnum(PlanType)
  plan_type: PlanType;

  @ApiPropertyOptional({ example: 'Basic plan with up to 500 batches/month' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  is_active: boolean;
}
