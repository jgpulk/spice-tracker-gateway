import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Sale } from './entities/sale.entity';
import { SaleBatch } from './entities/sale-batch.entity';
import { SaleStockItem } from './entities/sale-stock-item.entity';
import { StockBatch } from '../stock-batches/entities/stock-batch.entity';
import { GradedStock } from '../graded-stock/entities/graded-stock.entity';
import { BatchStatus } from '../../common/enums/batch-status.enum';
import { SaleType } from '../../common/enums/sale-type.enum';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale) private readonly saleRepo: Repository<Sale>,
    @InjectRepository(SaleBatch) private readonly saleBatchRepo: Repository<SaleBatch>,
    @InjectRepository(SaleStockItem) private readonly saleStockItemRepo: Repository<SaleStockItem>,
    @InjectRepository(StockBatch) private readonly batchRepo: Repository<StockBatch>,
    @InjectRepository(GradedStock) private readonly gradedStockRepo: Repository<GradedStock>,
  ) {}

  findAllByVendor(vendor_id: number) {
    return this.saleRepo.find({ where: { vendor_id }, relations: ['client'] });
  }

  async createDirectRawSale(vendor_id: number, client_id: number, batch_ids: number[], notes?: string) {
    const batches = await this.batchRepo.findBy({ id_stock_batch: In(batch_ids), vendor_id, status: BatchStatus.RECEIVED });
    const total_weight_kg = batches.reduce((sum, b) => sum + Number(b.raw_weight_kg), 0);
    const total_amount = batches.reduce((sum, b) => sum + Number(b.raw_weight_kg) * Number(b.price_per_kg), 0);

    const sale = await this.saleRepo.save(
      this.saleRepo.create({ vendor_id, client_id, sale_type: SaleType.DIRECT_RAW, total_weight_kg, total_amount, notes }),
    );
    await this.saleBatchRepo.save(batches.map((b) => this.saleBatchRepo.create({ sale, batch: b })));
    await this.batchRepo.update({ id_stock_batch: In(batch_ids) }, { status: BatchStatus.SOLD_RAW });
    return sale;
  }

  async createProcessedSale(
    vendor_id: number,
    client_id: number,
    items: { graded_stock_id: number; weight_kg: number; price_per_kg: number }[],
    notes?: string,
  ) {
    const total_weight_kg = items.reduce((sum, i) => sum + i.weight_kg, 0);
    const total_amount = items.reduce((sum, i) => sum + i.weight_kg * i.price_per_kg, 0);

    const sale = await this.saleRepo.save(
      this.saleRepo.create({ vendor_id, client_id, sale_type: SaleType.PROCESSED_GRADE, total_weight_kg, total_amount, notes }),
    );
    await this.saleStockItemRepo.save(
      items.map((i) =>
        this.saleStockItemRepo.create({
          sale,
          graded_stock: { id_graded_stock: i.graded_stock_id } as unknown as GradedStock,
          weight_kg: i.weight_kg,
          price_per_kg: i.price_per_kg,
          line_amount: i.weight_kg * i.price_per_kg,
        }),
      ),
    );
    return sale;
  }
}
