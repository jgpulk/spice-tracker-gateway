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

describe('Super admin creation — POST /api/v1/users/super-admin (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;

  let superAdminToken: string;
  let vendorOwnerToken: string;
  let warehouseStaffToken: string;
  let uniqueCounter = 0;

  const SEED_ADMIN_EMAIL = 'e2e-seed-admin@spicewallet.test';
  const SEED_ADMIN_PASSWORD = 'SeedAdminPass1!';
  const OWNER_EMAIL = 'e2e-owner@spicewallet.test';
  const OWNER_PASSWORD = 'OwnerPass123!';
  const STAFF_EMAIL = 'e2e-staff@spicewallet.test';
  const STAFF_PASSWORD = 'StaffPass123!';

  const validPayload = (overrides: Record<string, unknown> = {}) => {
    const n = ++uniqueCounter;
    return {
      name: 'New Super Admin',
      email: `super-admin-${n}@spicewallet.test`,
      password: 'ValidPass123!',
      ...overrides,
    };
  };

  const login = (email: string, password: string) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(201);

  const createSuperAdminAs = (token: string, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/api/v1/users/super-admin')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

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
        name: 'E2E Seed Super Admin',
        email: SEED_ADMIN_EMAIL,
        password_hash: await bcrypt.hash(SEED_ADMIN_PASSWORD, 10),
        role: Role.SUPER_ADMIN,
        vendor_id: null,
        is_active: true,
      }),
    );

    const vendor = await vendorRepo.save(
      vendorRepo.create({
        name: 'Owner Test Shop',
        subdomain: 'owner-test-shop',
        email: 'owner-test-shop@example.com',
        phone: '+919876500000',
        address: '1 Test Street',
        city: 'Kochi',
        state: 'Kerala',
        pincode: '682001',
      }),
    );

    await userRepo.save(
      userRepo.create({
        name: 'E2E Vendor Owner',
        email: OWNER_EMAIL,
        password_hash: await bcrypt.hash(OWNER_PASSWORD, 10),
        role: Role.VENDOR_OWNER,
        vendor_id: vendor.id_vendor,
        is_active: true,
      }),
    );

    await userRepo.save(
      userRepo.create({
        name: 'E2E Warehouse Staff',
        email: STAFF_EMAIL,
        password_hash: await bcrypt.hash(STAFF_PASSWORD, 10),
        role: Role.WAREHOUSE_STAFF,
        vendor_id: vendor.id_vendor,
        is_active: true,
      }),
    );

    superAdminToken = (await login(SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD)).body.data.access_token;
    vendorOwnerToken = (await login(OWNER_EMAIL, OWNER_PASSWORD)).body.data.access_token;
    warehouseStaffToken = (await login(STAFF_EMAIL, STAFF_PASSWORD)).body.data.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('authorization', () => {
    it('rejects an unauthenticated request', () => {
      return request(app.getHttpServer())
        .post('/api/v1/users/super-admin')
        .send(validPayload())
        .expect(401);
    });

    it('rejects a request with a garbage bearer token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/users/super-admin')
        .set('Authorization', 'Bearer not-a-real-jwt')
        .send(validPayload())
        .expect(401);
    });

    it('rejects a VENDOR_OWNER caller', async () => {
      const res = await createSuperAdminAs(vendorOwnerToken, validPayload()).expect(403);
      expect(res.body.status).toBe(false);
    });

    it('rejects a WAREHOUSE_STAFF caller', async () => {
      await createSuperAdminAs(warehouseStaffToken, validPayload()).expect(403);
    });
  });

  describe('validation', () => {
    it('rejects a missing name/email/password', async () => {
      const res = await createSuperAdminAs(superAdminToken, {}).expect(400);
      expect(res.body.status).toBe(false);
      expect(res.body.fields.name).toBeDefined();
      expect(res.body.fields.email).toBeDefined();
      expect(res.body.fields.password).toBeDefined();
    });

    it('rejects a name shorter than 2 characters', async () => {
      const res = await createSuperAdminAs(superAdminToken, validPayload({ name: 'A' })).expect(400);
      expect(res.body.fields.name).toBeDefined();
    });

    it('rejects a name longer than 255 characters', async () => {
      const res = await createSuperAdminAs(superAdminToken, validPayload({ name: 'A'.repeat(256) })).expect(
        400,
      );
      expect(res.body.fields.name).toBeDefined();
    });

    it('rejects an invalid email format', async () => {
      const res = await createSuperAdminAs(superAdminToken, validPayload({ email: 'not-an-email' })).expect(
        400,
      );
      expect(res.body.fields.email).toBeDefined();
    });

    it('rejects a password shorter than 8 characters', async () => {
      const res = await createSuperAdminAs(superAdminToken, validPayload({ password: 'short1' })).expect(400);
      expect(res.body.fields.password).toBeDefined();
    });

    it('rejects a non-string name with 400, not a 500 crash (transform runs before @IsString)', async () => {
      const res = await createSuperAdminAs(superAdminToken, validPayload({ name: 12345 })).expect(400);
      expect(res.body.fields.name).toBeDefined();
    });

    it('rejects a non-string email with 400, not a 500 crash', async () => {
      const res = await createSuperAdminAs(superAdminToken, validPayload({ email: 12345 })).expect(400);
      expect(res.body.fields.email).toBeDefined();
    });

    it('rejects unknown fields on the DTO (e.g. an explicit role)', () => {
      return createSuperAdminAs(superAdminToken, validPayload({ role: 'SUPER_ADMIN' })).expect(400);
    });

    it('trims the name and lowercases/trims the email before saving', async () => {
      const payload = validPayload({
        name: '  Padded Name  ',
        email: `  Mixed-Case-${++uniqueCounter}@Spicewallet.TEST  `,
      });

      await createSuperAdminAs(superAdminToken, payload).expect(201);

      const normalizedEmail = payload.email.trim().toLowerCase();
      const saved = await userRepo.findOneBy({ email: normalizedEmail });
      expect(saved).not.toBeNull();
      expect(saved!.name).toBe('Padded Name');

      // The email as originally submitted (untrimmed/mixed-case) must not exist verbatim.
      const rawMatch = await userRepo.findOneBy({ email: payload.email });
      expect(rawMatch).toBeNull();
    });
  });

  describe('happy path', () => {
    it('creates a super admin and returns no data payload, only a success message', async () => {
      const payload = validPayload();
      const res = await createSuperAdminAs(superAdminToken, payload).expect(201);

      expect(res.body).toEqual({ status: true, message: 'Super admin created successfully' });
      expect(res.body.data).toBeUndefined();
    });

    it('persists the new super admin with a hashed password, SUPER_ADMIN role, and no vendor', async () => {
      const payload = validPayload();
      await createSuperAdminAs(superAdminToken, payload).expect(201);

      const saved = await userRepo.findOneBy({ email: payload.email });
      expect(saved).not.toBeNull();
      expect(saved!.role).toBe(Role.SUPER_ADMIN);
      expect(saved!.vendor_id).toBeNull();
      expect(saved!.is_active).toBe(true);
      expect(saved!.password_hash).not.toBe(payload.password);
      await expect(bcrypt.compare(payload.password, saved!.password_hash)).resolves.toBe(true);
    });

    it('lets the newly created super admin log in and use the token', async () => {
      const payload = validPayload();
      await createSuperAdminAs(superAdminToken, payload).expect(201);

      const loginRes = await login(payload.email, payload.password);
      expect(loginRes.body.data.user.role).toBe(Role.SUPER_ADMIN);
      expect(loginRes.body.data.user.vendor_id).toBeNull();

      // Prove the new token actually carries SUPER_ADMIN privileges end-to-end
      // by hitting another super-admin-only route with it.
      await request(app.getHttpServer())
        .get('/api/v1/vendors')
        .set('Authorization', `Bearer ${loginRes.body.data.access_token}`)
        .expect(200);
    });
  });

  describe('duplicate email', () => {
    it('rejects an email already used by another super admin', async () => {
      const payload = validPayload();
      await createSuperAdminAs(superAdminToken, payload).expect(201);

      const res = await createSuperAdminAs(superAdminToken, validPayload({ email: payload.email })).expect(
        409,
      );
      expect(res.body.status).toBe(false);
      expect(res.body.message).toMatch(/email/i);
    });

    it('rejects an email already used by a non-super-admin user (global uniqueness)', async () => {
      const res = await createSuperAdminAs(superAdminToken, validPayload({ email: OWNER_EMAIL })).expect(409);
      expect(res.body.message).toMatch(/email/i);
    });

    it('is case-insensitive on duplicate detection since emails are lowercased before saving', async () => {
      const payload = validPayload();
      await createSuperAdminAs(superAdminToken, payload).expect(201);

      await createSuperAdminAs(
        superAdminToken,
        validPayload({ email: payload.email.toUpperCase() }),
      ).expect(409);
    });
  });
});
