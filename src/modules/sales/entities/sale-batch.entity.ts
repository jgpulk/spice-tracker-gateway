import { Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Sale } from './sale.entity';
import { StockBatch } from '../../stock-batches/entities/stock-batch.entity';

@Entity('sale_batches')
export class SaleBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Sale, (sale) => sale.sale_batches)
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @ManyToOne(() => StockBatch, (batch) => batch.sale_batches)
  @JoinColumn({ name: 'batch_id' })
  batch: StockBatch;
}
