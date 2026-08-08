import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { OnboardingSource } from '../entities/vendor.entity';

export class CreateVendorDto {
  // --- Shop identity ---
  @ApiProperty({ example: 'Green Cardamom Shop' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'green-cardamom', description: 'Unique URL-safe subdomain' })
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/, { message: 'subdomain must contain only lowercase letters, numbers, and hyphens' })
  subdomain: string;

  // --- Contact ---
  @ApiProperty({ example: 'shop@greencardamom.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+919876543210', description: 'Business phone number' })
  @IsString()
  @MaxLength(20)
  phone: string;

  // --- Address ---
  @ApiProperty({ example: '42, Market Street, Idukki' })
  @IsString()
  address: string;

  @ApiProperty({ example: 'Idukki' })
  @IsString()
  @MaxLength(100)
  city: string;

  @ApiProperty({ example: 'Kerala' })
  @IsString()
  @MaxLength(100)
  state: string;

  @ApiPropertyOptional({ example: 'India', default: 'India' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  country?: string;

  @ApiProperty({ example: '685602' })
  @IsString()
  @MaxLength(20)
  pincode: string;

  // --- Business details ---
  @ApiPropertyOptional({ example: 'GST29ABCDE1234F1Z5', description: 'GST or business registration number' })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  business_reg_no?: string;

  @ApiPropertyOptional({ example: 'Sole Proprietorship', description: 'e.g. Sole Proprietorship, Partnership, Pvt Ltd' })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  business_type?: string;

  // --- Onboarding tracking ---
  @ApiPropertyOptional({ enum: OnboardingSource, default: OnboardingSource.SUPER_ADMIN })
  @IsEnum(OnboardingSource)
  @IsOptional()
  onboarding_source?: OnboardingSource;

  @ApiPropertyOptional({ example: 3, description: 'vendor_id of the referring vendor (REFERRAL source only)' })
  @IsInt()
  @IsPositive()
  @IsOptional()
  referred_by_vendor_id?: number;
}
