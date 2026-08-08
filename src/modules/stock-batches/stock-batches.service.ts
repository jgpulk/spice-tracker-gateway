import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { StockBatch } from './entities/stock-batch.entity';
import { BatchStatus } from '../../common/enums/batch-status.enum';

@Injectable()
export class StockBatchesService {
  constructor(
    @InjectRepository(StockBatch)
    private readonly batchRepo: Repository<StockBatch>,
  ) {}

  findAllByVendor(vendor_id: number) {
    return this.batchRepo.find({ where: { vendor_id }, relations: ['farmer'] });
  }

  async findOne(id: number, vendor_id: number) {
    const batch = await this.batchRepo.findOne({ where: { id_stock_batch: id, vendor_id }, relations: ['farmer'] });
    if (!batch) throw new NotFoundException('Batch not found');
    return batch;
  }

  create(data: Partial<StockBatch>) {
    return this.batchRepo.save(this.batchRepo.create(data));
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
