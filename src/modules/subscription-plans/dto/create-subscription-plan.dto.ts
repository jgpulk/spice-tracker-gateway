import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { BillingCycle, PlanType } from '../entities/subscription-plan.entity';

export class CreateSubscriptionPlanDto {
  @ApiProperty({ example: 'Starter Monthly' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: PlanType, example: PlanType.STARTER })
  @IsEnum(PlanType)
  plan_type: PlanType;

  @ApiProperty({ enum: BillingCycle, example: BillingCycle.MONTHLY })
  @IsEnum(BillingCycle)
  billing_cycle: BillingCycle;

  @ApiProperty({ example: 299.99, description: 'Monthly fee in local currency' })
  @IsNumber()
  @IsPositive()
  monthly_fee: number;

  @ApiPropertyOptional({ example: 'Basic plan with up to 500 batches/month' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

}
