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

describe('Vendors — /api/v1/vendors/:id shared read + /api/v1/vendors/me profile (e2e)', () => {
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
    business_reg_no: '29ABCDEPROFA1Z5', // matches vendorA's own value — no conflict on self-update
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

  describe('GET /vendors/:id — shared by Super Admin and Vendor Owner', () => {
    it('rejects an unauthenticated request', () => {
      return request(app.getHttpServer()).get(`/api/v1/vendors/${vendorA.public_id}`).expect(401);
    });

    it('rejects a WAREHOUSE_STAFF caller — view-only staff has no vendor-management access', () => {
      return asStaffA(request(app.getHttpServer()).get(`/api/v1/vendors/${vendorA.public_id}`)).expect(403);
    });

    it('lets a SUPER_ADMIN fetch any vendor by id', async () => {
      const res = await asAdmin(request(app.getHttpServer()).get(`/api/v1/vendors/${vendorA.public_id}`)).expect(
        200,
      );
      expect(res.body.data.vendor_id).toBe(vendorA.public_id);
    });

    it("lets a VENDOR_OWNER fetch their own vendor by id without leaking internal ids", async () => {
      const res = await asOwnerA(request(app.getHttpServer()).get(`/api/v1/vendors/${vendorA.public_id}`)).expect(
        200,
      );

      const vendor = res.body.data;
      expect(vendor.vendor_id).toBe(vendorA.public_id);
      expect(vendor.name).toBe(vendorA.name);
      expect(vendor.subdomain).toBe(vendorA.subdomain);
      expect(vendor.subscriptions).toEqual([]);

      expect(vendor.id_vendor).toBeUndefined();
      expect(vendor.onboarded_by_user_id).toBeUndefined();
      expect(vendor.referred_by_vendor_id).toBeUndefined();
    });

    it("404s a VENDOR_OWNER who requests another vendor's id — cross-tenant lookup is blocked", async () => {
      await asOwnerA(request(app.getHttpServer()).get(`/api/v1/vendors/${vendorB.public_id}`)).expect(404);
      await asOwnerB(request(app.getHttpServer()).get(`/api/v1/vendors/${vendorA.public_id}`)).expect(404);
    });

    it('404s on an unknown vendor id for either role', async () => {
      const unknownId = '00000000-0000-0000-0000-000000000000';
      await asAdmin(request(app.getHttpServer()).get(`/api/v1/vendors/${unknownId}`)).expect(404);
      await asOwnerA(request(app.getHttpServer()).get(`/api/v1/vendors/${unknownId}`)).expect(404);
    });

    it("lets a VENDOR_OWNER pass 'me' instead of their own public_id", async () => {
      const res = await asOwnerA(request(app.getHttpServer()).get('/api/v1/vendors/me')).expect(200);
      expect(res.body.data.vendor_id).toBe(vendorA.public_id);

      const ownerBRes = await asOwnerB(request(app.getHttpServer()).get('/api/v1/vendors/me')).expect(200);
      expect(ownerBRes.body.data.vendor_id).toBe(vendorB.public_id);
    });

    it("404s a SUPER_ADMIN who passes 'me' — they have no vendor of their own", () => {
      return asAdmin(request(app.getHttpServer()).get('/api/v1/vendors/me')).expect(404);
    });

    it("404s a WAREHOUSE_STAFF who passes 'me' — same as any other id, blocked by role", () => {
      return asStaffA(request(app.getHttpServer()).get('/api/v1/vendors/me')).expect(403);
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

    it('updates the allowed business-detail fields, returning no data on the write itself', async () => {
      const res = await asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me'))
        .send(validProfilePayload({ city: 'Changed City' }))
        .expect(200);

      expect(res.body).toEqual({ status: true, message: 'Vendor profile updated successfully' });
      expect(res.body.data).toBeUndefined();

      const refetched = await asOwnerA(
        request(app.getHttpServer()).get(`/api/v1/vendors/${vendorA.public_id}`),
      ).expect(200);
      expect(refetched.body.data.city).toBe('Changed City');
    });

    it("never touches another vendor's record", async () => {
      await asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me'))
        .send(validProfilePayload({ name: 'Owner A Renamed Shop' }))
        .expect(200);

      const ownerBProfile = await asOwnerB(
        request(app.getHttpServer()).get(`/api/v1/vendors/${vendorB.public_id}`),
      ).expect(200);
      expect(ownerBProfile.body.data.name).toBe(vendorB.name);
    });

    it('rejects admin/create-only fields (subdomain, email, phone) as unknown', async () => {
      await asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me'))
        .send({ ...validProfilePayload(), subdomain: 'hijacked-subdomain' })
        .expect(400);

      await asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me'))
        .send({ ...validProfilePayload(), email: 'hijacked@example.com' })
        .expect(400);

      await asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me'))
        .send({ ...validProfilePayload(), phone: '+919999999999' })
        .expect(400);
    });

    it('updates business_reg_no', async () => {
      await asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me'))
        .send(validProfilePayload({ business_reg_no: '29OWNERUPDATED1Z5' }))
        .expect(200);

      const refetched = await asOwnerA(
        request(app.getHttpServer()).get(`/api/v1/vendors/${vendorA.public_id}`),
      ).expect(200);
      expect(refetched.body.data.business_reg_no).toBe('29OWNERUPDATED1Z5');

      // restore so later tests relying on the default payload's value keep working
      await asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me'))
        .send(validProfilePayload())
        .expect(200);
    });

    it('rejects updating business_reg_no to one already used by another vendor', async () => {
      const res = await asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me'))
        .send(validProfilePayload({ business_reg_no: vendorB.business_reg_no }))
        .expect(409);
      expect(res.body.message).toMatch(/business_reg_no/i);

      // vendor B's own record must be untouched by the rejected attempt
      const ownerBProfile = await asOwnerB(
        request(app.getHttpServer()).get(`/api/v1/vendors/${vendorB.public_id}`),
      ).expect(200);
      expect(ownerBProfile.body.data.business_reg_no).toBe(vendorB.business_reg_no);
    });

    it('allows re-saving a vendor with its own unchanged business_reg_no (not a false-positive duplicate)', async () => {
      await asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me'))
        .send(validProfilePayload())
        .expect(200);
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
      expect(res.body.fields.business_reg_no).toBeDefined();
      expect(res.body.fields.business_type).toBeDefined();
    });

    it('reports "should not be empty" as the first error for every missing required field — main.ts uses stopAtFirstError, so @IsNotEmpty must be declared before type/format decorators', async () => {
      const res = await asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me'))
        .send({})
        .expect(400);

      for (const field of ['name', 'address', 'city', 'state', 'country', 'pincode', 'business_reg_no', 'business_type']) {
        expect(res.body.fields[field][0]).toBe(`${field} should not be empty`);
      }
    });

    it('rejects a business_reg_no shorter than 3, longer than 50, or with invalid characters', async () => {
      const patch = (overrides: Record<string, unknown>) =>
        asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me')).send(validProfilePayload(overrides));

      await patch({ business_reg_no: 'AB' }).expect(400);
      await patch({ business_reg_no: 'A'.repeat(51) }).expect(400);
      await patch({ business_reg_no: 'GST@123!' }).expect(400);
    });

    it('rejects malformed fields (pincode, city)', async () => {
      const res = await asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me'))
        .send(validProfilePayload({ pincode: 'abc', city: 'Idukki123' }))
        .expect(400);

      expect(res.body.fields.pincode).toBeDefined();
      expect(res.body.fields.city).toBeDefined();
    });

    it('rejects a name shorter than 2, longer than 255, or non-string', async () => {
      const patch = (overrides: Record<string, unknown>) =>
        asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me')).send(validProfilePayload(overrides));

      await patch({ name: 'X' }).expect(400);
      await patch({ name: 'A'.repeat(256) }).expect(400);
      await patch({ name: 12345 }).expect(400);
    });

    it('rejects an empty or overlong address', async () => {
      const patch = (overrides: Record<string, unknown>) =>
        asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me')).send(validProfilePayload(overrides));

      await patch({ address: '' }).expect(400);
      await patch({ address: 'A'.repeat(501) }).expect(400);
    });

    it('rejects a city/state with digits/symbols or longer than 100 characters', async () => {
      const patch = (overrides: Record<string, unknown>) =>
        asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me')).send(validProfilePayload(overrides));

      await patch({ city: 'A'.repeat(101) }).expect(400);
      await patch({ state: 'Kerala!' }).expect(400);
      await patch({ state: 'A'.repeat(101) }).expect(400);
    });

    it('rejects an empty, overlong, or invalid country', async () => {
      const patch = (overrides: Record<string, unknown>) =>
        asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me')).send(validProfilePayload(overrides));

      await patch({ country: '' }).expect(400);
      await patch({ country: 'A'.repeat(101) }).expect(400);
      const res = await patch({ country: 'India123' }).expect(400);
      expect(res.body.fields.country).toBeDefined();
    });

    it('rejects a pincode shorter than 4 or longer than 10 digits', async () => {
      const patch = (overrides: Record<string, unknown>) =>
        asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me')).send(validProfilePayload(overrides));

      await patch({ pincode: '123' }).expect(400);
      await patch({ pincode: '12345678901' }).expect(400);
    });

    it('rejects an empty or overlong business_type', async () => {
      const patch = (overrides: Record<string, unknown>) =>
        asOwnerA(request(app.getHttpServer()).patch('/api/v1/vendors/me')).send(validProfilePayload(overrides));

      await patch({ business_type: '' }).expect(400);
      await patch({ business_type: 'A'.repeat(256) }).expect(400);
    });
  });
});
