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

  findAllByVendor(vendor_id: string) {
    return this.batchRepo.find({ where: { vendor_id }, relations: ['farmer'] });
  }

  async findOne(id: string, vendor_id: string) {
    const batch = await this.batchRepo.findOne({ where: { id, vendor_id }, relations: ['farmer'] });
    if (!batch) throw new NotFoundException('Batch not found');
    return batch;
  }

  create(data: Partial<StockBatch>) {
    return this.batchRepo.save(this.batchRepo.create(data));
  }

  async transitionStatus(ids: string[], vendor_id: string, newStatus: BatchStatus, allowedFrom: BatchStatus) {
    const batches = await this.batchRepo.findBy({ id: In(ids), vendor_id });
    const invalid = batches.filter((b) => b.status !== allowedFrom);
    if (invalid.length) {
      throw new BadRequestException(`Some batches are not in ${allowedFrom} status`);
    }
    await this.batchRepo.update({ id: In(ids) }, { status: newStatus });
    return this.batchRepo.findBy({ id: In(ids) });
  }
}
