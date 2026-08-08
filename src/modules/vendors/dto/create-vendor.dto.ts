import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { OnboardingSource } from '../entities/vendor.entity';

export class CreateVendorDto {
  @ApiProperty({ example: 'Green Cardamom Shop' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'green-cardamom' })
  @IsString()
  @MaxLength(100)
  subdomain: string;

  @ApiPropertyOptional({
    enum: OnboardingSource,
    default: OnboardingSource.SUPER_ADMIN,
    description: 'Set automatically by the server; provide only when needed',
  })
  @IsEnum(OnboardingSource)
  @IsOptional()
  onboarding_source?: OnboardingSource;

  @ApiPropertyOptional({
    example: 3,
    description: 'vendor_id of the referring vendor (only for REFERRAL source)',
  })
  @IsInt()
  @IsPositive()
  @IsOptional()
  referred_by_vendor_id?: number;
}
