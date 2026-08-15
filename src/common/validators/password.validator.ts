import { applyDecorators } from '@nestjs/common';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export const PASSWORD_MIN_LENGTH = 6;

// At least one letter, one digit, and one non-alphanumeric character. Length
// is enforced separately via @MinLength so validation errors can report it
// distinctly.
export const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).+$/;
export const PASSWORD_COMPLEXITY_MESSAGE =
  'password must contain at least one letter, one number, and one special character';
export const PASSWORD_RULE_DESCRIPTION = `Minimum ${PASSWORD_MIN_LENGTH} characters, at least 1 letter, 1 number, and 1 special character`;

// Single source of truth for every "set a new password" field (signup,
// staff/admin creation, change-password) so the rule can never drift between
// DTOs. Does not apply to LoginDto, which validates an existing password.
export function IsStrongPassword() {
  return applyDecorators(
    IsString(),
    IsNotEmpty(),
    MinLength(PASSWORD_MIN_LENGTH, { message: `password must be at least ${PASSWORD_MIN_LENGTH} characters` }),
    Matches(PASSWORD_COMPLEXITY_REGEX, { message: PASSWORD_COMPLEXITY_MESSAGE }),
  );
}
