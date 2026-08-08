import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VendorSubscription } from './vendor-subscription.entity';
import { User } from '../../users/entities/user.entity';
import { Farmer } from '../../farmers/entities/farmer.entity';
import { StockBatch } from '../../stock-batches/entities/stock-batch.entity';
import { DryingLot } from '../../drying-lots/entities/drying-lot.entity';
import { GradedStock } from '../../graded-stock/entities/graded-stock.entity';
import { Sale } from '../../sales/entities/sale.entity';
import { FarmerPayout } from '../../farmer-payouts/entities/farmer-payout.entity';

export enum VendorStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  TRIAL = 'TRIAL',
}

export enum OnboardingSource {
  SUPER_ADMIN = 'SUPER_ADMIN',
  SELF = 'SELF',
  REFERRAL = 'REFERRAL',
}

@Entity('vendors')
export class Vendor {
  @PrimaryGeneratedColumn()
  id_vendor: number;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 100, unique: true })
  subdomain: string;

  @Column({ type: 'enum', enum: VendorStatus, default: VendorStatus.TRIAL })
  status: VendorStatus;

  @Column({ type: 'enum', enum: OnboardingSource, default: OnboardingSource.SUPER_ADMIN })
  onboarding_source: OnboardingSource;

  @Column({ type: 'int', nullable: true })
  onboarded_by_user_id: number | null;

  @Column({ type: 'int', nullable: true })
  referred_by_vendor_id: number | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => VendorSubscription, (sub) => sub.vendor)
  subscriptions: VendorSubscription[];

  @OneToMany(() => User, (user) => user.vendor)
  users: User[];

  @OneToMany(() => Farmer, (farmer) => farmer.vendor)
  farmers: Farmer[];

  @OneToMany(() => StockBatch, (batch) => batch.vendor)
  stock_batches: StockBatch[];

  @OneToMany(() => DryingLot, (lot) => lot.vendor)
  drying_lots: DryingLot[];

  @OneToMany(() => GradedStock, (gs) => gs.vendor)
  graded_stocks: GradedStock[];

  @OneToMany(() => Sale, (sale) => sale.vendor)
  sales: Sale[];

  @OneToMany(() => FarmerPayout, (payout) => payout.vendor)
  farmer_payouts: FarmerPayout[];
}
