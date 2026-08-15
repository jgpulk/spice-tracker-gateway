import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsStrongPassword, PASSWORD_MIN_LENGTH, PASSWORD_RULE_DESCRIPTION } from '../../../common/validators/password.validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'oldSecret123' })
  @IsString()
  @IsNotEmpty()
  current_password: string;

  @ApiProperty({
    example: 'newSecret@456',
    minLength: PASSWORD_MIN_LENGTH,
    description: PASSWORD_RULE_DESCRIPTION,
  })
  @IsStrongPassword()
  new_password: string;
}
