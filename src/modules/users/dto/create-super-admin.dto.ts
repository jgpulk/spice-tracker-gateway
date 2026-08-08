import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateSuperAdminDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'admin2@spicewallet.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPassword!1', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
