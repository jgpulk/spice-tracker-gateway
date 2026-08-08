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

  async findOne(publicId: string, vendor_id: number) {
    const farmer = await this.farmerRepo.findOneBy({ public_id: publicId, vendor_id });
    if (!farmer) throw new NotFoundException('Farmer not found');
    return farmer;
  }

  create(data: Partial<Farmer>) {
    return this.farmerRepo.save(this.farmerRepo.create(data));
  }

  async update(publicId: string, vendor_id: number, data: Partial<Farmer>) {
    const farmer = await this.findOne(publicId, vendor_id);
    await this.farmerRepo.update(farmer.id_farmer, data);
    return this.findOne(publicId, vendor_id);
  }
}
