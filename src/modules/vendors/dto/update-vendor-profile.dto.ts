import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { trim } from '../../../common/transforms/string.transform';

export class UpdateVendorProfileDto {
  // --- Shop identity ---
  @ApiProperty({ example: 'Green Cardamom Shop' })
  @IsString()
  @MaxLength(255)
  @MinLength(2)
  @IsNotEmpty()
  @Transform(trim)
  name: string;

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
  @ApiProperty({ example: 'Sole Proprietorship', description: 'e.g. Sole Proprietorship, Partnership, Private Limited' })
  @IsString()
  @MaxLength(255)
  @IsNotEmpty()
  @Transform(trim)
  business_type: string;
}
