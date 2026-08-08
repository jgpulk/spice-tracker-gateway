import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AppModule } from './app.module';
import { User } from './modules/users/entities/user.entity';
import { Role } from './common/enums/role.enum';

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Seed script must not run in production. Aborting.');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const userRepo = app.get<Repository<User>>(getRepositoryToken(User));

    const existing = await userRepo.findOneBy({ role: Role.SUPER_ADMIN });
    if (existing) {
      console.log(`Super admin already exists: ${existing.email}`);
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
    console.log(`Super admin created: ${superAdmin.email}`);
    console.log('IMPORTANT: Change the password after first login.');
  } finally {
    await app.close();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
