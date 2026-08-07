import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vendor } from './entities/vendor.entity';

@Injectable()
export class VendorsService {
  constructor(
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
  ) {}

  findAll() {
    return this.vendorRepo.find();
  }

  async findOne(id: string) {
    const vendor = await this.vendorRepo.findOneBy({ id });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  create(data: Partial<Vendor>) {
    const vendor = this.vendorRepo.create(data);
    return this.vendorRepo.save(vendor);
  }

  async update(id: string, data: Partial<Vendor>) {
    await this.findOne(id);
    await this.vendorRepo.update(id, data);
    return this.findOne(id);
  }
}
