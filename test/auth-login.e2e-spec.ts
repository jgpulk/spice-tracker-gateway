import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/test-app';
import { User } from '../src/modules/users/entities/user.entity';
import { Role } from '../src/common/enums/role.enum';
import { Vendor } from '../src/modules/vendors/entities/vendor.entity';

describe('Auth — /api/v1/auth/login (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let vendor: Vendor;

  const ADMIN_EMAIL = 'e2e-login-admin@spicewallet.test';
  const ADMIN_PASSWORD = 'AdminPass123!';
  const OWNER_EMAIL = 'e2e-login-owner@spicewallet.test';
  const OWNER_PASSWORD = 'OwnerPass123!';
  const STAFF_EMAIL = 'e2e-login-staff@spicewallet.test';
  const STAFF_PASSWORD = 'StaffPass123!';
  const INACTIVE_EMAIL = 'e2e-login-inactive@spicewallet.test';
  const INACTIVE_PASSWORD = 'InactivePass123!';

  const login = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send(body);

  beforeAll(async () => {
    const { app: testApp, moduleFixture } = await createTestApp();
    app = testApp;

    userRepo = moduleFixture.get(getRepositoryToken(User));
    vendorRepo = moduleFixture.get(getRepositoryToken(Vendor));

    // Reset to a clean slate — this schema is dedicated to e2e runs (see .env.test).
    await userRepo.query('SET FOREIGN_KEY_CHECKS = 0');
    await userRepo.query('TRUNCATE TABLE users');
    await vendorRepo.query('TRUNCATE TABLE vendors');
    await userRepo.query('SET FOREIGN_KEY_CHECKS = 1');

    await userRepo.save(
      userRepo.create({
        name: 'E2E Login Admin',
        email: ADMIN_EMAIL,
        password_hash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        role: Role.SUPER_ADMIN,
        vendor_id: null,
        is_active: true,
      }),
    );

    vendor = await vendorRepo.save(
      vendorRepo.create({
        name: 'Login Test Shop',
        subdomain: 'login-test-shop',
        email: 'login-test-shop@example.com',
        phone: '+919876500001',
        address: '1 Test Street',
        city: 'Kochi',
        state: 'Kerala',
        pincode: '682001',
        business_reg_no: '29LOGINTEST0001',
        business_type: 'Sole Proprietorship',
      }),
    );

    await userRepo.save(
      userRepo.create({
        name: 'E2E Login Owner',
        email: OWNER_EMAIL,
        password_hash: await bcrypt.hash(OWNER_PASSWORD, 10),
        role: Role.VENDOR_OWNER,
        vendor_id: vendor.id_vendor,
        is_active: true,
      }),
    );

    await userRepo.save(
      userRepo.create({
        name: 'E2E Login Staff',
        email: STAFF_EMAIL,
        password_hash: await bcrypt.hash(STAFF_PASSWORD, 10),
        role: Role.WAREHOUSE_STAFF,
        vendor_id: vendor.id_vendor,
        is_active: true,
      }),
    );

    await userRepo.save(
      userRepo.create({
        name: 'E2E Login Inactive',
        email: INACTIVE_EMAIL,
        password_hash: await bcrypt.hash(INACTIVE_PASSWORD, 10),
        role: Role.VENDOR_OWNER,
        vendor_id: vendor.id_vendor,
        is_active: false,
      }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('happy path', () => {
    it('logs in a SUPER_ADMIN with an unscoped, working token', async () => {
      const res = await login({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }).expect(201);

      expect(res.body.status).toBe(true);
      const { access_token, user } = res.body.data;
      expect(typeof access_token).toBe('string');
      expect(access_token.split('.')).toHaveLength(3); // header.payload.signature

      expect(user.role).toBe(Role.SUPER_ADMIN);
      expect(user.vendor_id).toBeNull();
      expect(user.name).toBe('E2E Login Admin');
      // The user's internal numeric PK must never appear in a response.
      expect(user.id_user).toBeUndefined();
      expect(typeof user.id).toBe('string'); // public_id, not the internal id_user

      await request(app.getHttpServer())
        .get('/api/v1/vendors')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);
    });

    it('logs in a VENDOR_OWNER with a token scoped to their vendor', async () => {
      const res = await login({ email: OWNER_EMAIL, password: OWNER_PASSWORD }).expect(201);

      const { access_token, user } = res.body.data;
      expect(user.role).toBe(Role.VENDOR_OWNER);
      expect(user.vendor_id).toBe(vendor.public_id); // exposed as public_id, not the raw PK

      const staff = await request(app.getHttpServer())
        .get('/api/v1/staff')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);
      expect(staff.body.data.some((u: any) => u.email === OWNER_EMAIL)).toBe(true);

      // A VENDOR_OWNER token must not carry SUPER_ADMIN privileges.
      await request(app.getHttpServer())
        .get('/api/v1/vendors')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(403);
    });

    it('logs in a WAREHOUSE_STAFF with a token scoped to their vendor but no admin/owner privileges', async () => {
      const res = await login({ email: STAFF_EMAIL, password: STAFF_PASSWORD }).expect(201);

      const { access_token, user } = res.body.data;
      expect(user.role).toBe(Role.WAREHOUSE_STAFF);
      expect(user.vendor_id).toBe(vendor.public_id);

      // WAREHOUSE_STAFF is neither SUPER_ADMIN nor VENDOR_OWNER — both of
      // those role-gated routes must reject this token.
      await request(app.getHttpServer())
        .get('/api/v1/vendors')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/v1/staff')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(403);
    });
  });

  describe('invalid credentials', () => {
    it('rejects an unknown email', async () => {
      const res = await login({ email: 'nobody@spicewallet.test', password: 'WhateverPass123!' }).expect(
        401,
      );
      expect(res.body.status).toBe(false);
      expect(res.body.message).toBe('Invalid credentials');
    });

    it('rejects a wrong password with the exact same message (no user enumeration)', async () => {
      const wrongPassword = await login({ email: ADMIN_EMAIL, password: 'WrongPassword123!' }).expect(401);
      const unknownEmail = await login({ email: 'nobody@spicewallet.test', password: 'WrongPassword123!' }).expect(
        401,
      );
      expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
    });

    it('rejects login for a deactivated user even with the correct password', () => {
      return login({ email: INACTIVE_EMAIL, password: INACTIVE_PASSWORD }).expect(401);
    });
  });

  describe('email normalization', () => {
    it('logs in successfully when the email matches the stored casing exactly', () => {
      return login({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }).expect(201);
    });

    it('logs in with a different email casing than what was stored', async () => {
      // LoginDto has no @Transform to lowercase the email like signup does,
      // but the lookup still succeeds here — MySQL's default collation
      // (case-insensitive) does the normalization at the DB layer instead of
      // the application layer. Worth knowing this is collation-dependent,
      // not an explicit app-level guarantee.
      await login({ email: ADMIN_EMAIL.toUpperCase(), password: ADMIN_PASSWORD }).expect(201);
    });

    it('rejects an email with leading/trailing whitespace at the validation layer', async () => {
      // @IsEmail() itself rejects whitespace-padded input — this never even
      // reaches the credential check, unlike the case-sensitivity gap above.
      const res = await login({ email: `  ${ADMIN_EMAIL}  `, password: ADMIN_PASSWORD });
      expect(res.status).toBe(400);
    });
  });

  describe('validation', () => {
    it('rejects a missing email/password', async () => {
      const res = await login({}).expect(400);
      expect(res.body.fields.email).toBeDefined();
      expect(res.body.fields.password).toBeDefined();
    });

    it('rejects an invalid email format', async () => {
      const res = await login({ email: 'not-an-email', password: 'whatever1' }).expect(400);
      expect(res.body.fields.email).toBeDefined();
    });

    it('rejects a password shorter than 6 characters', async () => {
      const res = await login({ email: ADMIN_EMAIL, password: 'short' }).expect(400);
      expect(res.body.fields.password).toBeDefined();
    });

    it('rejects unknown fields on the DTO', () => {
      return login({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, remember_me: true }).expect(400);
    });
  });
});
