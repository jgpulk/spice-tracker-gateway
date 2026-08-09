import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.is_active) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const token = this.jwtService.sign({ sub: user.id_user, role: user.role, vendor_id: user.vendor_id });
    return {
      access_token: token,
      user: {
        id: user.public_id,
        name: user.name,
        role: user.role,
        vendor_id: user.vendor?.public_id ?? null,
      },
    };
  }

  async hashPassword(password: string) {
    return bcrypt.hash(password, 10);
  }
}
