import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GradedStock } from './entities/graded-stock.entity';
import { DryingLot } from '../drying-lots/entities/drying-lot.entity';
import { Grade } from '../../common/enums/grade.enum';

@Injectable()
export class GradedStockService {
  constructor(
    @InjectRepository(GradedStock)
    private readonly gradedStockRepo: Repository<GradedStock>,
    @InjectRepository(DryingLot)
    private readonly dryingLotRepo: Repository<DryingLot>,
  ) {}

  findAllByVendor(vendor_id: number) {
    return this.gradedStockRepo.find({ where: { vendor_id }, relations: ['drying_lot'] });
  }

  async findOne(publicId: string, vendor_id: number) {
    const stock = await this.gradedStockRepo.findOneBy({ public_id: publicId, vendor_id });
    if (!stock) throw new NotFoundException('Graded stock not found');
    return stock;
  }

  async create(data: {
    drying_lot_public_id: string;
    grade: Grade;
    weight_kg: number;
    price_per_kg: number;
    vendor_id: number;
  }) {
    const lot = await this.dryingLotRepo.findOneBy({ public_id: data.drying_lot_public_id, vendor_id: data.vendor_id });
    if (!lot) throw new NotFoundException('Drying lot not found');

    return this.gradedStockRepo.save(
      this.gradedStockRepo.create({
        vendor_id: data.vendor_id,
        drying_lot_id: lot.id_drying_lot,
        grade: data.grade,
        weight_kg: data.weight_kg,
        price_per_kg: data.price_per_kg,
      }),
    );
  }
}
