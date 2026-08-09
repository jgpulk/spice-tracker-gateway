import { randomUUID } from 'crypto';
import { Exclude } from 'class-transformer';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Vendor } from '../../vendors/entities/vendor.entity';
import { Farmer } from '../../farmers/entities/farmer.entity';
import { StockBatch } from '../../stock-batches/entities/stock-batch.entity';

export enum PayoutStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
}

@Entity('farmer_payouts')
export class FarmerPayout {
  @Exclude()
  @PrimaryGeneratedColumn()
  id_farmer_payout: number;

  @Column({ type: 'varchar', length: 36, unique: true })
  public_id: string;

  @Column()
  vendor_id: number;

  @Column()
  farmer_id: number;

  @Column()
  batch_id: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: PayoutStatus, default: PayoutStatus.PENDING })
  status: PayoutStatus;

  @Column({ type: 'date', nullable: true })
  due_date: Date;

  @Column({ type: 'timestamp', nullable: true })
  paid_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @BeforeInsert()
  setPublicId() {
    this.public_id = randomUUID();
  }

  @ManyToOne(() => Vendor, (vendor) => vendor.farmer_payouts)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @ManyToOne(() => Farmer, (farmer) => farmer.payouts)
  @JoinColumn({ name: 'farmer_id' })
  farmer: Farmer;

  @ManyToOne(() => StockBatch, (batch) => batch.payouts)
  @JoinColumn({ name: 'batch_id' })
  batch: StockBatch;
}
