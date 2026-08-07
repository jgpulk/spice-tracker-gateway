import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Vendor } from '../../vendors/entities/vendor.entity';
import { StockBatch } from '../../stock-batches/entities/stock-batch.entity';
import { FarmerPayout } from '../../farmer-payouts/entities/farmer-payout.entity';

@Entity('farmers')
export class Farmer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  vendor_id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 50 })
  phone: string;

  @Column({ type: 'text', nullable: true })
  location: string;

  @Column({ length: 100, nullable: true })
  bank_account: string;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Vendor, (vendor) => vendor.farmers)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @OneToMany(() => StockBatch, (batch) => batch.farmer)
  stock_batches: StockBatch[];

  @OneToMany(() => FarmerPayout, (payout) => payout.farmer)
  payouts: FarmerPayout[];
}
