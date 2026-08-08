import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Vendor } from './vendor.entity';

export enum PlanType {
  STARTER = 'STARTER',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
  PAST_DUE = 'PAST_DUE',
}

@Entity('vendor_subscriptions')
export class VendorSubscription {
  @PrimaryGeneratedColumn()
  id_vendor_subscription: number;

  @Column()
  vendor_id: number;

  @Column({ type: 'enum', enum: PlanType, default: PlanType.STARTER })
  plan_type: PlanType;

  @Column({ type: 'enum', enum: SubscriptionStatus, default: SubscriptionStatus.ACTIVE })
  status: SubscriptionStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monthly_fee: number;

  @Column({ type: 'date' })
  start_date: Date;

  @Column({ type: 'date', nullable: true })
  end_date: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToOne(() => Vendor, (vendor) => vendor.subscription)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;
}
