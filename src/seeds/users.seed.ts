import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../modules/users/entities/user.entity';
import { Role } from '../common/enums/role.enum';

export async function seedSuperAdmin(userRepo: Repository<User>) {
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
    name: 'Joyal George',
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
