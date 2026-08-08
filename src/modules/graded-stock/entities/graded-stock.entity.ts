import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Grade } from '../../../common/enums/grade.enum';
import { Vendor } from '../../vendors/entities/vendor.entity';
import { DryingLot } from '../../drying-lots/entities/drying-lot.entity';
import { SaleStockItem } from '../../sales/entities/sale-stock-item.entity';

@Entity('graded_stock')
export class GradedStock {
  @PrimaryGeneratedColumn()
  id_graded_stock: number;

  @Column()
  vendor_id: number;

  @Column()
  drying_lot_id: number;

  @Column({ type: 'enum', enum: Grade })
  grade: Grade;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  weight_kg: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price_per_kg: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Vendor, (vendor) => vendor.graded_stocks)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @ManyToOne(() => DryingLot, (lot) => lot.graded_stocks)
  @JoinColumn({ name: 'drying_lot_id' })
  drying_lot: DryingLot;

  @OneToMany(() => SaleStockItem, (item) => item.graded_stock)
  sale_stock_items: SaleStockItem[];
}
