import { Controller, Post, Body } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ResponseMessage('Login successful')
  @ApiOperation({ summary: '✅ Verified — Login and receive a JWT token' })
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }
}
