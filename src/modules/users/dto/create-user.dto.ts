import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { trim, trimLower } from '../../../common/transforms/string.transform';
import { IsStrongPassword, PASSWORD_MIN_LENGTH, PASSWORD_RULE_DESCRIPTION } from '../../../common/validators/password.validator';

export class CreateUserDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MaxLength(255)
  @MinLength(2)
  @IsNotEmpty()
  @Transform(trim)
  name: string;

  @ApiProperty({ example: 'staff@shop.com' })
  @IsEmail()
  @IsNotEmpty()
  @Transform(trimLower)
  email: string;

  @ApiProperty({
    example: 'secret@123',
    minLength: PASSWORD_MIN_LENGTH,
    description: PASSWORD_RULE_DESCRIPTION,
  })
  @IsStrongPassword()
  password: string;
}
