import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BatchStatus } from '../../../common/enums/batch-status.enum';
import { Vendor } from '../../vendors/entities/vendor.entity';
import { Farmer } from '../../farmers/entities/farmer.entity';
import { DryingLot } from '../../drying-lots/entities/drying-lot.entity';
import { SaleBatch } from '../../sales/entities/sale-batch.entity';
import { FarmerPayout } from '../../farmer-payouts/entities/farmer-payout.entity';

@Entity('stock_batches')
export class StockBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  vendor_id: string;

  @Column('uuid')
  farmer_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  raw_weight_kg: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price_per_kg: number;

  @Column({ type: 'enum', enum: BatchStatus, default: BatchStatus.RECEIVED })
  status: BatchStatus;

  @Column('uuid', { nullable: true })
  drying_lot_id: string;

  @CreateDateColumn()
  received_at: Date;

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
