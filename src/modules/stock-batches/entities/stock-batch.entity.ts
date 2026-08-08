import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { BatchStatus } from '../../../common/enums/batch-status.enum';
import { Vendor } from '../../vendors/entities/vendor.entity';
import { Farmer } from '../../farmers/entities/farmer.entity';
import { DryingLot } from '../../drying-lots/entities/drying-lot.entity';
import { SaleBatch } from '../../sales/entities/sale-batch.entity';
import { FarmerPayout } from '../../farmer-payouts/entities/farmer-payout.entity';

@Entity('stock_batches')
export class StockBatch {
  @PrimaryGeneratedColumn()
  id_stock_batch: number;

  @Column()
  vendor_id: number;

  @Column()
  farmer_id: number;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  raw_weight_kg: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price_per_kg: number;

  @Column({ type: 'enum', enum: BatchStatus, default: BatchStatus.RECEIVED })
  status: BatchStatus;

  @Column({ nullable: true })
  drying_lot_id: number;

  @CreateDateColumn()
  received_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @ManyToOne(() => Vendor, (vendor) => vendor.stock_batches)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @ManyToOne(() => Farmer, (farmer) => farmer.stock_batches)
  @JoinColumn({ name: 'farmer_id' })
  farmer: Farmer;

  @ManyToOne(() => DryingLot, (lot) => lot.stock_batches, { nullable: true })
  @JoinColumn({ name: 'drying_lot_id' })
  drying_lot: DryingLot;

  @OneToMany(() => SaleBatch, (sb) => sb.batch)
  sale_batches: SaleBatch[];

  @OneToMany(() => FarmerPayout, (payout) => payout.batch)
  payouts: FarmerPayout[];
}
