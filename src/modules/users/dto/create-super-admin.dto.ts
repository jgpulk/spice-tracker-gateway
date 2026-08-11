import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { trim, trimLower } from '../../../common/transforms/string.transform';

export class CreateSuperAdminDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  @Transform(trim)
  name: string;

  @ApiProperty({ example: 'admin2@spicewallet.com' })
  @IsEmail()
  @Transform(trimLower)
  email: string;

  @ApiProperty({ example: 'StrongPassword!1', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
