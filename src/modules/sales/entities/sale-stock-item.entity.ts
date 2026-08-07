import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Sale } from './sale.entity';
import { GradedStock } from '../../graded-stock/entities/graded-stock.entity';

@Entity('sale_stock_items')
export class SaleStockItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  weight_kg: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price_per_kg: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  line_amount: number;

  @ManyToOne(() => Sale, (sale) => sale.sale_stock_items)
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @ManyToOne(() => GradedStock, (gs) => gs.sale_stock_items)
  @JoinColumn({ name: 'graded_stock_id' })
  graded_stock: GradedStock;
}
