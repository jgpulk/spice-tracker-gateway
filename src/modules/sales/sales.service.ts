import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Sale } from './entities/sale.entity';
import { SaleBatch } from './entities/sale-batch.entity';
import { SaleStockItem } from './entities/sale-stock-item.entity';
import { StockBatch } from '../stock-batches/entities/stock-batch.entity';
import { GradedStock } from '../graded-stock/entities/graded-stock.entity';
import { Client } from '../clients/entities/client.entity';
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
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
  ) {}

  findAllByVendor(vendor_id: number) {
    return this.saleRepo.find({ where: { vendor_id }, relations: ['client'] });
  }

  async createDirectRawSale(
    vendor_id: number,
    client_public_id: string,
    batch_public_ids: string[],
    notes?: string,
  ) {
    const client = await this.clientRepo.findOneBy({ public_id: client_public_id });
    if (!client) throw new NotFoundException('Client not found');

    const batches = await this.batchRepo.findBy({
      public_id: In(batch_public_ids),
      vendor_id,
      status: BatchStatus.RECEIVED,
    });
    const total_weight_kg = batches.reduce((sum, b) => sum + Number(b.raw_weight_kg), 0);
    const total_amount = batches.reduce((sum, b) => sum + Number(b.raw_weight_kg) * Number(b.price_per_kg), 0);

    const sale = await this.saleRepo.save(
      this.saleRepo.create({
        vendor_id,
        client_id: client.id_client,
        sale_type: SaleType.DIRECT_RAW,
        total_weight_kg,
        total_amount,
        notes,
      }),
    );
    await this.saleBatchRepo.save(batches.map((b) => this.saleBatchRepo.create({ sale, batch: b })));
    const batchInternalIds = batches.map((b) => b.id_stock_batch);
    await this.batchRepo.update({ id_stock_batch: In(batchInternalIds) }, { status: BatchStatus.SOLD_RAW });
    return sale;
  }

  async createProcessedSale(
    vendor_id: number,
    client_public_id: string,
    items: { graded_stock_public_id: string; weight_kg: number; price_per_kg: number }[],
    notes?: string,
  ) {
    const client = await this.clientRepo.findOneBy({ public_id: client_public_id });
    if (!client) throw new NotFoundException('Client not found');

    const stockPublicIds = items.map((i) => i.graded_stock_public_id);
    const ownedStock = await this.gradedStockRepo.findBy({ public_id: In(stockPublicIds), vendor_id });
    if (ownedStock.length !== stockPublicIds.length) {
      throw new NotFoundException('One or more graded stock items not found');
    }

    const stockMap = new Map(ownedStock.map((s) => [s.public_id, s]));
    const total_weight_kg = items.reduce((sum, i) => sum + i.weight_kg, 0);
    const total_amount = items.reduce((sum, i) => sum + i.weight_kg * i.price_per_kg, 0);

    const sale = await this.saleRepo.save(
      this.saleRepo.create({
        vendor_id,
        client_id: client.id_client,
        sale_type: SaleType.PROCESSED_GRADE,
        total_weight_kg,
        total_amount,
        notes,
      }),
    );
    await this.saleStockItemRepo.save(
      items.map((i) => {
        const stock = stockMap.get(i.graded_stock_public_id)!;
        return this.saleStockItemRepo.create({
          sale,
          graded_stock: stock,
          weight_kg: i.weight_kg,
          price_per_kg: i.price_per_kg,
          line_amount: i.weight_kg * i.price_per_kg,
        });
      }),
    );
    return sale;
  }
}
