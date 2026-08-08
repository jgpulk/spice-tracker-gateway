import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { StockBatch } from './entities/stock-batch.entity';
import { Farmer } from '../farmers/entities/farmer.entity';
import { BatchStatus } from '../../common/enums/batch-status.enum';

@Injectable()
export class StockBatchesService {
  constructor(
    @InjectRepository(StockBatch)
    private readonly batchRepo: Repository<StockBatch>,
    @InjectRepository(Farmer)
    private readonly farmerRepo: Repository<Farmer>,
  ) {}

  findAllByVendor(vendor_id: number) {
    return this.batchRepo.find({ where: { vendor_id }, relations: ['farmer'] });
  }

  async findOne(publicId: string, vendor_id: number) {
    const batch = await this.batchRepo.findOne({
      where: { public_id: publicId, vendor_id },
      relations: ['farmer'],
    });
    if (!batch) throw new NotFoundException('Batch not found');
    return batch;
  }

  async create(data: {
    farmer_public_id: string;
    raw_weight_kg: number;
    price_per_kg: number;
    notes?: string;
    vendor_id: number;
  }) {
    const farmer = await this.farmerRepo.findOneBy({ public_id: data.farmer_public_id, vendor_id: data.vendor_id });
    if (!farmer) throw new NotFoundException('Farmer not found');

    return this.batchRepo.save(
      this.batchRepo.create({
        vendor_id: data.vendor_id,
        farmer_id: farmer.id_farmer,
        raw_weight_kg: data.raw_weight_kg,
        price_per_kg: data.price_per_kg,
        notes: data.notes,
      }),
    );
  }

  async transitionStatus(ids: number[], vendor_id: number, newStatus: BatchStatus, allowedFrom: BatchStatus) {
    const batches = await this.batchRepo.findBy({ id_stock_batch: In(ids), vendor_id });
    const invalid = batches.filter((b) => b.status !== allowedFrom);
    if (invalid.length) {
      throw new BadRequestException(`Some batches are not in ${allowedFrom} status`);
    }
    await this.batchRepo.update({ id_stock_batch: In(ids) }, { status: newStatus });
    return this.batchRepo.findBy({ id_stock_batch: In(ids) });
  }
}
