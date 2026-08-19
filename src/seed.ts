import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from './app.module';
import { User } from './modules/users/entities/user.entity';
import { SubscriptionPlan } from './modules/subscription-plans/entities/subscription-plan.entity';
import { seedSuperAdmin } from './seeds/users.seed';
import { seedSubscriptionPlans } from './seeds/subscription-plans.seed';

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
