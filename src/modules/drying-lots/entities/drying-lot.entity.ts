import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Vendor } from '../../vendors/entities/vendor.entity';
import { StockBatch } from '../../stock-batches/entities/stock-batch.entity';
import { GradedStock } from '../../graded-stock/entities/graded-stock.entity';

export enum DryingLotStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}

@Entity('drying_lots')
export class DryingLot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  vendor_id: string;

  @Column({ length: 100 })
  lot_name: string;

  @Column({ type: 'enum', enum: DryingLotStatus, default: DryingLotStatus.ACTIVE })
  status: DryingLotStatus;

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 0 })
  initial_weight_kg: number;

  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true })
  final_dry_weight_kg: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  yield_pct: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  started_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date;

  @ManyToOne(() => Vendor, (vendor) => vendor.drying_lots)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @OneToMany(() => StockBatch, (batch) => batch.drying_lot)
  stock_batches: StockBatch[];

  @OneToMany(() => GradedStock, (gs) => gs.drying_lot)
  graded_stocks: GradedStock[];
}
