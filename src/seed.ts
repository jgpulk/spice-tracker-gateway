import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AppModule } from './app.module';
import { User } from './modules/users/entities/user.entity';
import { Role } from './common/enums/role.enum';
import {
  BillingCycle,
  PlanType,
  SubscriptionPlan,
} from './modules/subscription-plans/entities/subscription-plan.entity';

const DEFAULT_PLANS = [
  {
    name: 'Starter Monthly',
    plan_type: PlanType.STARTER,
    billing_cycle: BillingCycle.MONTHLY,
    monthly_fee: 299,
    description: 'Basic plan — up to 200 batches/month, 2 staff accounts',
    is_active: true,
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

async function seedSuperAdmin(userRepo: Repository<User>) {
  const existing = await userRepo.findOneBy({ role: Role.SUPER_ADMIN });
  if (existing) {
    console.log(`  Super admin already exists: ${existing.email}`);
    return;
  }

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error(
      'Missing required env vars: SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set.',
    );
    process.exit(1);
  }

  const superAdmin = userRepo.create({
    name: 'Super Admin',
    email,
    password_hash: await bcrypt.hash(password, 10),
    role: Role.SUPER_ADMIN,
    vendor_id: null,
    is_active: true,
  });

  await userRepo.save(superAdmin);
  console.log(`  Super admin created: ${superAdmin.email}`);
  console.log('  IMPORTANT: Change the password after first login.');
}

async function seedSubscriptionPlans(planRepo: Repository<SubscriptionPlan>) {
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

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Seed script must not run in production. Aborting.');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const userRepo = app.get<Repository<User>>(getRepositoryToken(User));
    const planRepo = app.get<Repository<SubscriptionPlan>>(
      getRepositoryToken(SubscriptionPlan),
    );

    console.log('\n[Seed] Super Admin');
    await seedSuperAdmin(userRepo);

    console.log('\n[Seed] Subscription Plans');
    await seedSubscriptionPlans(planRepo);

    console.log('\n[Seed] Done.\n');
  } finally {
    await app.close();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
