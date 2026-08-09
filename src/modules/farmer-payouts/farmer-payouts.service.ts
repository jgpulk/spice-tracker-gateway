import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FarmerPayout, PayoutStatus } from './entities/farmer-payout.entity';
import { Farmer } from '../farmers/entities/farmer.entity';
import { StockBatch } from '../stock-batches/entities/stock-batch.entity';

@Injectable()
export class FarmerPayoutsService {
  constructor(
    @InjectRepository(FarmerPayout)
    private readonly payoutRepo: Repository<FarmerPayout>,
    @InjectRepository(Farmer)
    private readonly farmerRepo: Repository<Farmer>,
    @InjectRepository(StockBatch)
    private readonly batchRepo: Repository<StockBatch>,
  ) {}

  findAllByVendor(vendor_id: number) {
    return this.payoutRepo.find({ where: { vendor_id }, relations: ['farmer', 'batch'] });
  }

  async markPaid(publicId: string, vendor_id: number) {
    const payout = await this.payoutRepo.findOneBy({ public_id: publicId, vendor_id });
    if (!payout) throw new NotFoundException('Payout not found');
    await this.payoutRepo.update(payout.id_farmer_payout, { status: PayoutStatus.PAID, paid_at: new Date() });
    return this.payoutRepo.findOneBy({ public_id: publicId });
  }

  async create(data: {
    farmer_public_id: string;
    batch_public_id: string;
    amount: number;
    due_date?: Date;
    vendor_id: number;
  }) {
    const farmer = await this.farmerRepo.findOneBy({ public_id: data.farmer_public_id, vendor_id: data.vendor_id });
    if (!farmer) throw new NotFoundException('Farmer not found');

    const batch = await this.batchRepo.findOneBy({ public_id: data.batch_public_id, vendor_id: data.vendor_id });
    if (!batch) throw new NotFoundException('Batch not found');

    return this.payoutRepo.save(
      this.payoutRepo.create({
        vendor_id: data.vendor_id,
        farmer_id: farmer.id_farmer,
        batch_id: batch.id_stock_batch,
        amount: data.amount,
        due_date: data.due_date,
      }),
    );
  }
}
