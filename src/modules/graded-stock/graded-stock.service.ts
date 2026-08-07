import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GradedStock } from './entities/graded-stock.entity';

@Injectable()
export class GradedStockService {
  constructor(
    @InjectRepository(GradedStock)
    private readonly gradedStockRepo: Repository<GradedStock>,
  ) {}

  findAllByVendor(vendor_id: string) {
    return this.gradedStockRepo.find({ where: { vendor_id }, relations: ['drying_lot'] });
  }

  async findOne(id: string, vendor_id: string) {
    const stock = await this.gradedStockRepo.findOneBy({ id, vendor_id });
    if (!stock) throw new NotFoundException('Graded stock not found');
    return stock;
  }

  create(data: Partial<GradedStock>) {
    return this.gradedStockRepo.save(this.gradedStockRepo.create(data));
  }
}
