import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { OnboardingSource } from '../entities/vendor.entity';

export class CreateVendorDto {
  // --- Shop identity ---
  @ApiProperty({ example: 'Green Cardamom Shop' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({ example: 'green-cardamom', description: 'Unique URL-safe subdomain (lowercase letters, numbers, hyphens only)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'subdomain must contain only lowercase letters, numbers, and hyphens',
  })
  subdomain: string;

  // --- Contact ---
  @ApiProperty({ example: 'shop@greencardamom.com' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(255)
  @Transform(({ value }) => value?.trim().toLowerCase())
  email: string;

  @ApiProperty({ example: '+919876543210', description: 'Valid phone number with optional + country code' })
  @Matches(/^\+?[0-9]{7,15}$/, {
    message: 'phone must contain only digits with an optional leading + (e.g. +919876543210)',
  })
  phone: string;

  // --- Address ---
  @ApiProperty({ example: '42, Market Street, Idukki' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  address: string;

  @ApiProperty({ example: 'Idukki' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-zA-Z\s\-'.]+$/, { message: 'city must contain only letters, spaces, hyphens, or apostrophes' })
  @Transform(({ value }) => value?.trim())
  city: string;

  @ApiProperty({ example: 'Kerala' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-zA-Z\s\-'.]+$/, { message: 'state must contain only letters, spaces, hyphens, or apostrophes' })
  @Transform(({ value }) => value?.trim())
  state: string;

  @ApiPropertyOptional({ example: 'India', default: 'India' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Matches(/^[a-zA-Z\s\-'.]+$/, { message: 'country must contain only letters, spaces, hyphens, or apostrophes' })
  @Transform(({ value }) => value?.trim())
  country?: string;

  @ApiProperty({ example: '685602', description: '4–10 digit postal code' })
  @Matches(/^[0-9]{4,10}$/, { message: 'pincode must contain only digits (4–10 digits)' })
  pincode: string;

  // --- Business details ---
  @ApiPropertyOptional({
    example: '29ABCDE1234F1Z5',
    description: 'GST or business registration number (alphanumeric, 3–50 chars)',
  })
  @IsOptional()
  @Matches(/^[A-Za-z0-9\-/]{3,50}$/, {
    message: 'business_reg_no must be alphanumeric (letters, digits, hyphens, slashes)',
  })
  @Transform(({ value }) => value?.trim().toUpperCase())
  business_reg_no?: string;

  @ApiPropertyOptional({
    example: 'Sole Proprietorship',
    description: 'e.g. Sole Proprietorship, Partnership, Private Limited',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  business_type?: string;

  // --- Onboarding tracking ---
  @ApiPropertyOptional({ enum: OnboardingSource, default: OnboardingSource.SUPER_ADMIN })
  @IsEnum(OnboardingSource)
  @IsOptional()
  onboarding_source?: OnboardingSource;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'public_id of the referring vendor — only valid when onboarding_source is REFERRAL',
  })
  @IsUUID()
  @IsOptional()
  referred_by_vendor_public_id?: string;
}
