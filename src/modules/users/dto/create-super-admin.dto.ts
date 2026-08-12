import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { trim, trimLower } from '../../../common/transforms/string.transform';

export class CreateSuperAdminDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MaxLength(255)
  @MinLength(2)
  @IsNotEmpty()
  @Transform(trim)
  name: string;

  @ApiProperty({ example: 'admin2@spicewallet.com' })
  @IsEmail()
  @MaxLength(255)
  @IsNotEmpty()
  @Transform(trimLower)
  email: string;

  @ApiProperty({ example: 'StrongPassword!1', minLength: 8 })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password: string;
}
