import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  findByEmail(email: string) {
    return this.userRepo.findOneBy({ email });
  }

  findAllByVendor(vendor_id: number) {
    return this.userRepo.findBy({ vendor_id });
  }

  async findOne(id: number) {
    const user = await this.userRepo.findOneBy({ id_user: id });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  create(data: Partial<User>) {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }

  async update(id: number, data: Partial<User>) {
    await this.findOne(id);
    await this.userRepo.update(id, data);
    return this.findOne(id);
  }
}
