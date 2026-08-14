import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  findByEmail(email: string) {
    return this.userRepo.findOne({ where: { email }, relations: ['vendor'] });
  }

  findAllByVendor(vendor_id: number) {
    return this.userRepo.findBy({ vendor_id });
  }

  async findOne(id: number, vendor_id?: number) {
    const where = vendor_id !== undefined ? { id_user: id, vendor_id } : { id_user: id };
    const user = await this.userRepo.findOneBy(where);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  create(data: Partial<User>) {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }

  async createSuperAdmin(name: string, email: string, password: string) {
    const existing = await this.userRepo.findOneBy({ email });
    if (existing) throw new ConflictException('Email already in use');

    const user = this.userRepo.create({
      name,
      email,
      password_hash: await bcrypt.hash(password, 10),
      role: Role.SUPER_ADMIN,
      vendor_id: null,
      is_active: true,
    });
    return this.userRepo.save(user);
  }

  async update(id: number, data: Partial<User>, vendor_id?: number) {
    await this.findOne(id, vendor_id);
    await this.userRepo.update(id, data);
    return this.findOne(id, vendor_id);
  }

  async changePassword(id: number, currentPassword: string, newPassword: string) {
    const user = await this.findOne(id);

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    await this.userRepo.update(id, { password_hash: await bcrypt.hash(newPassword, 10) });
  }
}
