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
import { trim, trimLower, trimUpper } from '../../../common/transforms/string.transform';
import { IsStrongPassword, PASSWORD_MIN_LENGTH, PASSWORD_RULE_DESCRIPTION } from '../../../common/validators/password.validator';
import { OnboardingSource } from '../entities/vendor.entity';

export class CreateVendorDto {
  // --- Shop identity ---
  @ApiProperty({ example: 'Green Cardamom Shop' })
  @IsString()
  @MaxLength(255)
  @MinLength(2)
  @IsNotEmpty()
  @Transform(trim)
  name: string;

  @ApiProperty({ example: 'green-cardamom', description: 'Unique URL-safe subdomain (lowercase letters, numbers, hyphens only)' })
  @IsString()
  @MaxLength(100)
  @MinLength(2)
  @Matches(/^[a-z0-9-]+$/, { message: 'subdomain must contain only lowercase letters, numbers, and hyphens' })
  @IsNotEmpty()
  subdomain: string;

  // --- Contact ---
  @ApiProperty({ example: 'shop@greencardamom.com' })
  @MaxLength(255)
  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsNotEmpty()
  @Transform(trimLower)
  email: string;

  @ApiProperty({ example: '+919876543210', description: 'Valid phone number with optional + country code' })
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must contain only digits with an optional leading + (e.g. +919876543210)' })
  @IsNotEmpty()
  phone: string;

  // --- Address ---
  @ApiProperty({ example: '42, Market Street, Idukki' })
  @IsString()
  @MaxLength(500)
  @IsNotEmpty()
  @Transform(trim)
  address: string;

  @ApiProperty({ example: 'Idukki' })
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-zA-Z\s\-'.]+$/, { message: 'city must contain only letters, spaces, hyphens, or apostrophes' })
  @IsNotEmpty()
  @Transform(trim)
  city: string;

  @ApiProperty({ example: 'Kerala' })
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-zA-Z\s\-'.]+$/, { message: 'state must contain only letters, spaces, hyphens, or apostrophes' })
  @IsNotEmpty()
  @Transform(trim)
  state: string;

  @ApiProperty({ example: 'India' })
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-zA-Z\s\-'.]+$/, {
    message:
      'country must contain only letters, spaces, hyphens, or apostrophes',
  })
  @IsNotEmpty()
  @Transform(trim)
  country: string;

  @ApiProperty({ example: '685602', description: '4–10 digit postal code' })
  @Matches(/^[0-9]{4,10}$/, { message: 'pincode must contain only digits (4–10 digits)' })
  @IsNotEmpty()
  pincode: string;

  // --- Business details ---
  @ApiProperty({ example: '29ABCDE1234F1Z5', description: 'GST or business registration number (alphanumeric, 3–50 chars)' })
  @Matches(/^[A-Za-z0-9\-/]{3,50}$/, { message: 'business_reg_no must be alphanumeric (letters, digits, hyphens, slashes)' })
  @IsNotEmpty()
  @Transform(trimUpper)
  business_reg_no: string;

  @ApiProperty({ example: 'Sole Proprietorship', description: 'e.g. Sole Proprietorship, Partnership, Private Limited' })
  @IsString()
  @MaxLength(255)
  @IsNotEmpty()
  @Transform(trim)
  business_type: string;

  // --- Owner account (used only on creation) ---
  @ApiProperty({ example: 'Ravi Kumar', description: 'Name of the vendor owner' })
  @IsString()
  @MaxLength(255)
  @MinLength(2)
  @IsNotEmpty()
  @Transform(trim)
  owner_name: string;

  @ApiProperty({ example: 'ravi@greencardamom.com', description: 'Login email for the vendor owner account' })
  @MaxLength(255)
  @IsEmail({}, { message: 'owner_email must be a valid email address' })
  @IsNotEmpty()
  @Transform(trimLower)
  owner_email: string;

  @ApiProperty({
    example: 'Secret@123',
    minLength: PASSWORD_MIN_LENGTH,
    description: `Password for the vendor owner login. ${PASSWORD_RULE_DESCRIPTION}`,
  })
  @IsStrongPassword()
  owner_password: string;

  // --- Onboarding tracking ---
  @ApiPropertyOptional({ enum: OnboardingSource, default: OnboardingSource.SUPER_ADMIN })
  @IsEnum(OnboardingSource)
  @IsOptional()
  onboarding_source?: OnboardingSource;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'id of the referring vendor — only valid when onboarding_source is REFERRAL',
  })
  @IsUUID()
  @IsOptional()
  referred_by_vendor_id?: string;
}
