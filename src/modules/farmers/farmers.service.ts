import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Farmer } from './entities/farmer.entity';

@Injectable()
export class FarmersService {
  constructor(
    @InjectRepository(Farmer)
    private readonly farmerRepo: Repository<Farmer>,
  ) {}

  findAllByVendor(vendor_id: number) {
    return this.farmerRepo.findBy({ vendor_id, is_active: true });
  }

  async findOne(id: number, vendor_id: number) {
    const farmer = await this.farmerRepo.findOneBy({ id_farmer: id, vendor_id });
    if (!farmer) throw new NotFoundException('Farmer not found');
    return farmer;
  }

  create(data: Partial<Farmer>) {
    return this.farmerRepo.save(this.farmerRepo.create(data));
  }

  async update(id: number, vendor_id: number, data: Partial<Farmer>) {
    await this.findOne(id, vendor_id);
    await this.farmerRepo.update(id, data);
    return this.findOne(id, vendor_id);
  }
}
