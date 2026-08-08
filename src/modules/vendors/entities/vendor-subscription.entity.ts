import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Vendor } from './vendor.entity';
import { SubscriptionPlan } from '../../subscription-plans/entities/subscription-plan.entity';

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  PAST_DUE = 'PAST_DUE',
}

@Entity('vendor_subscriptions')
export class VendorSubscription {
  @PrimaryGeneratedColumn()
  id_vendor_subscription: number;

  @Column()
  vendor_id: number;

  @Column({ type: 'int', nullable: true })
  plan_id: number | null;

  @Column({ type: 'enum', enum: SubscriptionStatus, default: SubscriptionStatus.ACTIVE })
  status: SubscriptionStatus;

  @Column({ type: 'date' })
  start_date: Date;

  @Column({ type: 'date', nullable: true })
  end_date: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Vendor, (vendor) => vendor.subscriptions)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @ManyToOne(() => SubscriptionPlan, (plan) => plan.vendor_subscriptions, { nullable: true })
  @JoinColumn({ name: 'plan_id' })
  plan: SubscriptionPlan | null;
}
