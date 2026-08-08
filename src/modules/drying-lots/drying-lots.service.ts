import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DryingLot, DryingLotStatus } from './entities/drying-lot.entity';
import { StockBatch } from '../stock-batches/entities/stock-batch.entity';
import { BatchStatus } from '../../common/enums/batch-status.enum';

@Injectable()
export class DryingLotsService {
  constructor(
    @InjectRepository(DryingLot)
    private readonly lotRepo: Repository<DryingLot>,
    @InjectRepository(StockBatch)
    private readonly batchRepo: Repository<StockBatch>,
  ) {}

  findAllByVendor(vendor_id: number) {
    return this.lotRepo.find({ where: { vendor_id }, relations: ['stock_batches'] });
  }

  async findOne(id: number, vendor_id: number) {
    const lot = await this.lotRepo.findOne({ where: { id_drying_lot: id, vendor_id }, relations: ['stock_batches', 'graded_stocks'] });
    if (!lot) throw new NotFoundException('Drying lot not found');
    return lot;
  }

  async create(vendor_id: number, lot_name: string, batch_ids: number[]) {
    const batches = await this.batchRepo.findBy({ id_stock_batch: In(batch_ids), vendor_id, status: BatchStatus.RECEIVED });
    const initial_weight_kg = batches.reduce((sum, b) => sum + Number(b.raw_weight_kg), 0);

    const lot = await this.lotRepo.save(this.lotRepo.create({ vendor_id, lot_name, initial_weight_kg }));
    await this.batchRepo.update({ id_stock_batch: In(batch_ids) }, { status: BatchStatus.IN_DRYING, drying_lot_id: lot.id_drying_lot });
    return lot;
  }

  async complete(id: number, vendor_id: number, final_dry_weight_kg: number) {
    const lot = await this.findOne(id, vendor_id);
    const yield_pct = (final_dry_weight_kg / Number(lot.initial_weight_kg)) * 100;
    const batchIds = lot.stock_batches.map((b) => b.id_stock_batch);

    await this.lotRepo.update(id, {
      final_dry_weight_kg,
      yield_pct: parseFloat(yield_pct.toFixed(2)),
      status: DryingLotStatus.COMPLETED,
      completed_at: new Date(),
    });
    await this.batchRepo.update({ id_stock_batch: In(batchIds) }, { status: BatchStatus.PROCESSED });
    return this.findOne(id, vendor_id);
  }
}
