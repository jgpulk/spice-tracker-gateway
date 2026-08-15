import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/test-app';
import { User } from '../src/modules/users/entities/user.entity';
import { Role } from '../src/common/enums/role.enum';
import { Vendor, VendorStatus } from '../src/modules/vendors/entities/vendor.entity';
import { VendorSubscription } from '../src/modules/vendors/entities/vendor-subscription.entity';

describe('Users — PATCH /api/v1/users/me/password (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let subscriptionRepo: Repository<VendorSubscription>;

  const ADMIN_EMAIL = 'e2e-pwd-admin@spicewallet.test';
  const ADMIN_PASSWORD = 'TestPass123!';
  const OWNER_EMAIL = 'e2e-pwd-owner@spicewallet.test';
  const OWNER_PASSWORD = 'OwnerPass123!';
  const STAFF_EMAIL = 'e2e-pwd-staff@spicewallet.test';
  const STAFF_PASSWORD = 'StaffPass123!';

  const login = async (email: string, password: string) =>
    (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(201)
    ).body.data.access_token;

  beforeAll(async () => {
    const { app: testApp, moduleFixture } = await createTestApp();
    app = testApp;

    userRepo = moduleFixture.get(getRepositoryToken(User));
    vendorRepo = moduleFixture.get(getRepositoryToken(Vendor));
    subscriptionRepo = moduleFixture.get(getRepositoryToken(VendorSubscription));

    // Reset to a clean slate — this schema is dedicated to e2e runs (see .env.test).
    await subscriptionRepo.query('SET FOREIGN_KEY_CHECKS = 0');
    await subscriptionRepo.query('TRUNCATE TABLE vendor_subscriptions');
    await vendorRepo.query('TRUNCATE TABLE vendors');
    await userRepo.query('TRUNCATE TABLE users');
    await subscriptionRepo.query('SET FOREIGN_KEY_CHECKS = 1');

    await userRepo.save(
      userRepo.create({
        name: 'E2E Password Admin',
        email: ADMIN_EMAIL,
        password_hash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        role: Role.SUPER_ADMIN,
        vendor_id: null,
        is_active: true,
      }),
    );

    const vendor = await vendorRepo.save(
      vendorRepo.create({
        name: 'Password Test Shop',
        subdomain: 'password-test-shop',
        email: 'shop-password-test@example.com',
        phone: '+919876500000',
        address: '1, Test Street',
        city: 'Kochi',
        state: 'Kerala',
        country: 'India',
        pincode: '682001',
        business_reg_no: '29ABCDEPWTEST1Z5',
        business_type: 'Sole Proprietorship',
        status: VendorStatus.ACTIVE,
      }),
    );

    await userRepo.save(
      userRepo.create({
        name: 'E2E Password Owner',
        email: OWNER_EMAIL,
        password_hash: await bcrypt.hash(OWNER_PASSWORD, 10),
        role: Role.VENDOR_OWNER,
        vendor_id: vendor.id_vendor,
        is_active: true,
      }),
    );
    await userRepo.save(
      userRepo.create({
        name: 'E2E Password Staff',
        email: STAFF_EMAIL,
        password_hash: await bcrypt.hash(STAFF_PASSWORD, 10),
        role: Role.WAREHOUSE_STAFF,
        vendor_id: vendor.id_vendor,
        is_active: true,
      }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an unauthenticated request', () => {
    return request(app.getHttpServer())
      .patch('/api/v1/users/me/password')
      .send({ current_password: OWNER_PASSWORD, new_password: 'NewSecret123!' })
      .expect(401);
  });

  it('rejects an incorrect current_password', async () => {
    const token = await login(OWNER_EMAIL, OWNER_PASSWORD);

    await request(app.getHttpServer())
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'WrongPassword!', new_password: 'NewSecret123!' })
      .expect(401);

    // password must be unchanged — old one still works
    await login(OWNER_EMAIL, OWNER_PASSWORD);
  });

  it('rejects a new_password identical to the current password', async () => {
    const token = await login(OWNER_EMAIL, OWNER_PASSWORD);

    await request(app.getHttpServer())
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: OWNER_PASSWORD, new_password: OWNER_PASSWORD })
      .expect(400);

    // password must be unchanged — old one still works
    await login(OWNER_EMAIL, OWNER_PASSWORD);
  });

  it('rejects a new_password shorter than 6 characters', async () => {
    const token = await login(OWNER_EMAIL, OWNER_PASSWORD);

    const res = await request(app.getHttpServer())
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: OWNER_PASSWORD, new_password: 'ab' })
      .expect(400);
    expect(res.body.fields.new_password).toBeDefined();
  });

  it('rejects a new_password missing a letter, a number, or a special character', async () => {
    const token = await login(OWNER_EMAIL, OWNER_PASSWORD);

    const noNumber = await request(app.getHttpServer())
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: OWNER_PASSWORD, new_password: 'NoDigits!' })
      .expect(400);
    expect(noNumber.body.fields.new_password).toBeDefined();

    const noSpecialChar = await request(app.getHttpServer())
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: OWNER_PASSWORD, new_password: 'NoSpecial123' })
      .expect(400);
    expect(noSpecialChar.body.fields.new_password).toBeDefined();

    const noLetter = await request(app.getHttpServer())
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: OWNER_PASSWORD, new_password: '12345!123456' })
      .expect(400);
    expect(noLetter.body.fields.new_password).toBeDefined();
  });

  it('rejects missing fields', async () => {
    const token = await login(OWNER_EMAIL, OWNER_PASSWORD);

    const res = await request(app.getHttpServer())
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);
    expect(res.body.fields.current_password).toBeDefined();
    expect(res.body.fields.new_password).toBeDefined();
  });

  it('changes a VENDOR_OWNER password and the old password stops working', async () => {
    const token = await login(OWNER_EMAIL, OWNER_PASSWORD);
    const newPassword = 'BrandNewSecret456!';

    const res = await request(app.getHttpServer())
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: OWNER_PASSWORD, new_password: newPassword })
      .expect(200);

    expect(res.body.data).toBeUndefined();
    expect(res.body.password_hash).toBeUndefined();

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD })
      .expect(401);

    await login(OWNER_EMAIL, newPassword);
  });

  it('also works for SUPER_ADMIN and WAREHOUSE_STAFF — no role restriction on this route', async () => {
    const adminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    await request(app.getHttpServer())
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ current_password: ADMIN_PASSWORD, new_password: 'AdminNewSecret789!' })
      .expect(200);
    await login(ADMIN_EMAIL, 'AdminNewSecret789!');

    const staffToken = await login(STAFF_EMAIL, STAFF_PASSWORD);
    await request(app.getHttpServer())
      .patch('/api/v1/users/me/password')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ current_password: STAFF_PASSWORD, new_password: 'StaffNewSecret789!' })
      .expect(200);
    await login(STAFF_EMAIL, 'StaffNewSecret789!');
  });
});
