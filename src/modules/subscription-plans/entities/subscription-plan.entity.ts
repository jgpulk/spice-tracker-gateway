import { randomUUID } from 'crypto';
import { Exclude } from 'class-transformer';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VendorSubscription } from '../../vendors/entities/vendor-subscription.entity';

export enum PlanType {
  STARTER = 'STARTER',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export enum BillingCycle {
  MONTHLY = 'MONTHLY',
  ANNUAL = 'ANNUAL',
}

@Entity('subscription_plans')
export class SubscriptionPlan {
  @Exclude()
  @PrimaryGeneratedColumn()
  id_subscription_plan: number;

  @Column({ type: 'varchar', length: 36, unique: true })
  public_id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'enum', enum: PlanType })
  plan_type: PlanType;

  @Column({ type: 'enum', enum: BillingCycle, default: BillingCycle.MONTHLY })
  billing_cycle: BillingCycle;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  monthly_fee: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: true })
  is_active: boolean;

  @Column({ default: false })
  is_default_trial: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @BeforeInsert()
  setPublicId() {
    this.public_id = randomUUID();
  }

  @OneToMany(() => VendorSubscription, (sub) => sub.plan)
  vendor_subscriptions: VendorSubscription[];
}
