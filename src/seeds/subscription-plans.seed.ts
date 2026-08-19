import { Repository } from 'typeorm';
import {
  BillingCycle,
  PlanType,
  SubscriptionPlan,
} from '../modules/subscription-plans/entities/subscription-plan.entity';

const DEFAULT_PLANS = [
  {
    name: 'Starter Monthly',
    plan_type: PlanType.STARTER,
    billing_cycle: BillingCycle.MONTHLY,
    monthly_fee: 299,
    description: 'Basic plan — up to 200 batches/month, 2 staff accounts',
    is_active: true,
    is_default_trial: true,
  },
  {
    name: 'Starter Annual',
    plan_type: PlanType.STARTER,
    billing_cycle: BillingCycle.ANNUAL,
    monthly_fee: 249,
    description: 'Starter plan billed annually (save ~17%)',
    is_active: true,
  },
  {
    name: 'Pro Monthly',
    plan_type: PlanType.PRO,
    billing_cycle: BillingCycle.MONTHLY,
    monthly_fee: 799,
    description: 'Pro plan — unlimited batches, 10 staff accounts, analytics',
    is_active: true,
  },
  {
    name: 'Pro Annual',
    plan_type: PlanType.PRO,
    billing_cycle: BillingCycle.ANNUAL,
    monthly_fee: 649,
    description: 'Pro plan billed annually (save ~19%)',
    is_active: true,
  },
  {
    name: 'Enterprise Monthly',
    plan_type: PlanType.ENTERPRISE,
    billing_cycle: BillingCycle.MONTHLY,
    monthly_fee: 1999,
    description:
      'Enterprise — unlimited everything, dedicated support, custom integrations',
    is_active: true,
  },
  {
    name: 'Enterprise Annual',
    plan_type: PlanType.ENTERPRISE,
    billing_cycle: BillingCycle.ANNUAL,
    monthly_fee: 1649,
    description: 'Enterprise plan billed annually (save ~18%)',
    is_active: true,
  },
];

export async function seedSubscriptionPlans(planRepo: Repository<SubscriptionPlan>) {
  const existing = await planRepo.count();
  if (existing > 0) {
    console.log(
      `  Subscription plans already seeded (${existing} plans found). Skipping.`,
    );
    return;
  }

  const plans = planRepo.create(DEFAULT_PLANS);
  await planRepo.save(plans);
  console.log(`  Created ${plans.length} subscription plans.`);
}
