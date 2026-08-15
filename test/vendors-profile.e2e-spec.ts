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

describe('Vendors — /api/v1/vendors/me (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let subscriptionRepo: Repository<VendorSubscription>;

  let superAdminToken: string;
  let ownerAToken: string;
  let ownerBToken: string;
  let staffAToken: string;
  let vendorA: Vendor;
  let vendorB: Vendor;

  const ADMIN_EMAIL = 'e2e-profile-admin@spicewallet.test';
  const ADMIN_PASSWORD = 'TestPass123!';
  const OWNER_A_EMAIL = 'e2e-profile-owner-a@spicewallet.test';
  const OWNER_A_PASSWORD = 'OwnerAPass123!';
  const OWNER_B_EMAIL = 'e2e-profile-owner-b@spicewallet.test';
  const OWNER_B_PASSWORD = 'OwnerBPass123!';
  const STAFF_A_EMAIL = 'e2e-profile-staff-a@spicewallet.test';
  const STAFF_A_PASSWORD = 'StaffAPass123!';

  const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${superAdminToken}`);
  const asOwnerA = (req: request.Test) => req.set('Authorization', `Bearer ${ownerAToken}`);
  const asOwnerB = (req: request.Test) => req.set('Authorization', `Bearer ${ownerBToken}`);
  const asStaffA = (req: request.Test) => req.set('Authorization', `Bearer ${staffAToken}`);

  const validProfilePayload = (overrides: Record<string, unknown> = {}) => ({
    name: 'Green Cardamom Shop',
    address: '42, Market Street, Idukki',
    city: 'Idukki',
    state: 'Kerala',
    country: 'India',
    pincode: '685602',
    business_type: 'Sole Proprietorship',
    ...overrides,
  });

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
        name: 'E2E Super Admin',
        email: ADMIN_EMAIL,
        password_hash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        role: Role.SUPER_ADMIN,
        vendor_id: null,
        is_active: true,
      }),
    );

    vendorA = await vendorRepo.save(
      vendorRepo.create({
        name: 'Green Cardamom Shop',
        subdomain: 'green-cardamom-profile-a',
        email: 'shop-profile-a@greencardamom.com',
        phone: '+919876543210',
        address: '42, Market Street, Idukki',
        city: 'Idukki',
        state: 'Kerala',
        country: 'India',
        pincode: '685602',
        business_reg_no: '29ABCDEPROFA1Z5',
        business_type: 'Sole Proprietorship',
        status: VendorStatus.ACTIVE,
      }),
    );
    vendorB = await vendorRepo.save(
      vendorRepo.create({
        name: 'Blue Pepper Traders',
        subdomain: 'blue-pepper-profile-b',
        email: 'shop-profile-b@bluepepper.com',
        phone: '+919876543211',
        address: '7, Spice Lane, Kochi',
        city: 'Kochi',
        state: 'Kerala',
        country: 'India',
        pincode: '682001',
        business_reg_no: '29ABCDEPROFB1Z5',
        business_type: 'Partnership',
        status: VendorStatus.ACTIVE,
      }),
    );

    await userRepo.save(
      userRepo.create({
        name: 'E2E Owner A',
        email: OWNER_A_EMAIL,
        password_hash: await bcrypt.hash(OWNER_A_PASSWORD, 10),
        role: Role.VENDOR_OWNER,
        vendor_id: vendorA.id_vendor,
        is_active: true,
      }),
    );
    await userRepo.save(
      userRepo.create({
        name: 'E2E Owner B',
        email: OWNER_B_EMAIL,
        password_hash: await bcrypt.hash(OWNER_B_PASSWORD, 10),
        role: Role.VENDOR_OWNER,
        vendor_id: vendorB.id_vendor,
        is_active: true,
      }),
    );
    await userRepo.save(
      userRepo.create({
        name: 'E2E Staff A',
        email: STAFF_A_EMAIL,
        password_hash: await bcrypt.hash(STAFF_A_PASSWORD, 10),
        role: Role.WAREHOUSE_STAFF,
        vendor_id: vendorA.id_vendor,
        is_active: true,
      }),
    );

    superAdminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    ownerAToken = await login(OWNER_A_EMAIL, OWNER_A_PASSWORD);
    ownerBToken = await login(OWNER_B_EMAIL, OWNER_B_PASSWORD);
    staffAToken = await login(STAFF_A_EMAIL, STAFF_A_PASSWORD);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /vendors/me', () => {
    it('rejects an unauthenticated request', () => {
      return request(app.getHttpServer()).get('/api/v1/vendors/me').expect(401);
    });

    it('rejects a SUPER_ADMIN caller — no vendor context', () => {
      return asAdmin(request(app.getHttpServer()).get('/api/v1/vendors/me')).expect(403);
    });

    it('rejects a WAREHOUSE_STAFF caller — view-only staff has no vendor-management access', () => {
      return asStaffA(request(app.getHttpServer()).get('/api/v1/vendors/me')).expect(403);
    });

    it("returns the caller's own vendor profile without leaking internal ids", async () => {
      const res = await asOwnerA(request(app.getHttpServer()).get('/api/v1/vendors/me')).expect(200);

      const vendor = res.body.data;
      expect(vendor.public_id).toBe(vendorA.public_id);
      expect(vendor.name).toBe(vendorA.name);
      expect(vendor.subdomain).toBe(vendorA.subdomain);
      expect(vendor.subscriptions).toEqual([]);

      expect(vendor.id_vendor).toBeUndefined();
      expect(vendor.onboarded_by_user_id).toBeUndefined();
      expect(vendor.referred_by_vendor_id).toBeUndefined();
    });

    it("scopes to the caller's own vendor — owner B never sees vendor A's data", async () => {
      const res = await asOwnerB(request(app.getHttpServer()).get('/api/v1/vendors/me')).expect(200);
      expect(res.body.data.public_id).toBe(vendorB.public_id);
      expect(res.body.data.public_id).not.toBe(vendorA.public_id);
    });
  });

  describe('PATCH /vendors/me', () => {
    it('rejects an unauthenticated request', () => {
      return request(app.getHttpServer())
        .patch('/api/v1/vendors/me')
        .send(validProfilePayload())
        .expect(401);
    });

    it('rejects a SUPER_ADMIN caller', () => {
      return asAdmin(request(app.getHttpServer()).patch('/api/v1/vendors/me'))
        .send(validProfilePayload())
        .expect(403);
    });

    it('rejects a WAREHOUSE_STAFF caller', () => {
      return asStaffA(request(app.getHttpServer()).patch('/api/v1/vendors/me'))
        .send(validProfilePayload())
        .expect(403);
    });

    it('updates the allowed business-detail fields', async () => {
      const res = await asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me'))
        .send(validProfilePayload({ city: 'Changed City' }))
        .expect(200);

      expect(res.body.data.city).toBe('Changed City');

      const refetched = await asOwnerA(request(app.getHttpServer()).get('/api/v1/vendors/me')).expect(200);
      expect(refetched.body.data.city).toBe('Changed City');
    });

    it("never touches another vendor's record", async () => {
      await asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me'))
        .send(validProfilePayload({ name: 'Owner A Renamed Shop' }))
        .expect(200);

      const ownerBProfile = await asOwnerB(request(app.getHttpServer()).get('/api/v1/vendors/me')).expect(200);
      expect(ownerBProfile.body.data.name).toBe(vendorB.name);
    });

    it('rejects admin/create-only fields (subdomain, business_reg_no, email, phone) as unknown', async () => {
      await asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me'))
        .send({ ...validProfilePayload(), subdomain: 'hijacked-subdomain' })
        .expect(400);

      await asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me'))
        .send({ ...validProfilePayload(), business_reg_no: '29HIJACKED0001Z5' })
        .expect(400);

      await asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me'))
        .send({ ...validProfilePayload(), email: 'hijacked@example.com' })
        .expect(400);

      await asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me'))
        .send({ ...validProfilePayload(), phone: '+919999999999' })
        .expect(400);
    });

    it('rejects missing required fields', async () => {
      const res = await asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me'))
        .send({})
        .expect(400);

      expect(res.body.fields.name).toBeDefined();
      expect(res.body.fields.address).toBeDefined();
      expect(res.body.fields.city).toBeDefined();
      expect(res.body.fields.state).toBeDefined();
      expect(res.body.fields.country).toBeDefined();
      expect(res.body.fields.pincode).toBeDefined();
      expect(res.body.fields.business_type).toBeDefined();
    });

    it('rejects malformed fields (pincode, city)', async () => {
      const res = await asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me'))
        .send(validProfilePayload({ pincode: 'abc', city: 'Idukki123' }))
        .expect(400);

      expect(res.body.fields.pincode).toBeDefined();
      expect(res.body.fields.city).toBeDefined();
    });
  });
});
