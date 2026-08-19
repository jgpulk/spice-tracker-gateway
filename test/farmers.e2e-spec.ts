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
import { Farmer } from '../src/modules/farmers/entities/farmer.entity';

describe('Farmers — /api/v1/farmers (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let farmerRepo: Repository<Farmer>;

  let ownerAToken: string;
  let ownerBToken: string;
  let staffAToken: string;
  let superAdminToken: string;
  let vendorA: Vendor;
  let vendorB: Vendor;
  let uniqueCounter = 0;

  const ADMIN_EMAIL = 'e2e-farmers-admin@spicewallet.test';
  const ADMIN_PASSWORD = 'AdminPass123!';
  const OWNER_A_EMAIL = 'e2e-farmers-owner-a@spicewallet.test';
  const OWNER_A_PASSWORD = 'OwnerAPass123!';
  const OWNER_B_EMAIL = 'e2e-farmers-owner-b@spicewallet.test';
  const OWNER_B_PASSWORD = 'OwnerBPass123!';
  const STAFF_A_EMAIL = 'e2e-farmers-staff-a@spicewallet.test';
  const STAFF_A_PASSWORD = 'StaffAPass123!';

  const asOwnerA = (req: request.Test) => req.set('Authorization', `Bearer ${ownerAToken}`);
  const asOwnerB = (req: request.Test) => req.set('Authorization', `Bearer ${ownerBToken}`);
  const asStaffA = (req: request.Test) => req.set('Authorization', `Bearer ${staffAToken}`);
  const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${superAdminToken}`);

  const validFarmerPayload = (overrides: Record<string, unknown> = {}) => {
    const n = ++uniqueCounter;
    return {
      name: 'Rajan Kumar',
      phone: `+9198765${String(40000 + n).padStart(5, '0')}`,
      location: 'Idukki, Kerala',
      bank_account: `SB${String(n).padStart(10, '0')}`,
      ...overrides,
    };
  };

  const login = async (email: string, password: string) =>
    (
      await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(201)
    ).body.data.access_token;

  const createFarmerAsOwnerA = (overrides: Record<string, unknown> = {}) =>
    asOwnerA(request(app.getHttpServer()).post('/api/v1/farmers')).send(validFarmerPayload(overrides));

  beforeAll(async () => {
    const { app: testApp, moduleFixture } = await createTestApp();
    app = testApp;

    userRepo = moduleFixture.get(getRepositoryToken(User));
    vendorRepo = moduleFixture.get(getRepositoryToken(Vendor));
    farmerRepo = moduleFixture.get(getRepositoryToken(Farmer));

    // Reset to a clean slate — this schema is dedicated to e2e runs (see .env.test).
    await farmerRepo.query('SET FOREIGN_KEY_CHECKS = 0');
    await farmerRepo.query('TRUNCATE TABLE farmers');
    await vendorRepo.query('TRUNCATE TABLE vendors');
    await userRepo.query('TRUNCATE TABLE users');
    await farmerRepo.query('SET FOREIGN_KEY_CHECKS = 1');

    await userRepo.save(
      userRepo.create({
        name: 'E2E Farmers Admin',
        email: ADMIN_EMAIL,
        password_hash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        role: Role.SUPER_ADMIN,
        vendor_id: null,
        is_active: true,
      }),
    );

    vendorA = await vendorRepo.save(
      vendorRepo.create({
        name: 'Farmers Test Shop A',
        subdomain: 'farmers-test-shop-a',
        email: 'shop-farmers-a@example.com',
        phone: '+919876500001',
        address: '1, Test Street',
        city: 'Kochi',
        state: 'Kerala',
        country: 'India',
        pincode: '682001',
        business_reg_no: '29ABCDEFARMA1Z5',
        business_type: 'Sole Proprietorship',
        status: VendorStatus.ACTIVE,
      }),
    );
    vendorB = await vendorRepo.save(
      vendorRepo.create({
        name: 'Farmers Test Shop B',
        subdomain: 'farmers-test-shop-b',
        email: 'shop-farmers-b@example.com',
        phone: '+919876500002',
        address: '2, Test Street',
        city: 'Kochi',
        state: 'Kerala',
        country: 'India',
        pincode: '682002',
        business_reg_no: '29ABCDEFARMB1Z5',
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

  describe('authorization', () => {
    it('rejects an unauthenticated request on every route', async () => {
      await request(app.getHttpServer()).get('/api/v1/farmers').expect(401);
      await request(app.getHttpServer()).post('/api/v1/farmers').send(validFarmerPayload()).expect(401);
    });

    it('rejects a SUPER_ADMIN caller — this route is VENDOR_OWNER only', async () => {
      await asAdmin(request(app.getHttpServer()).get('/api/v1/farmers')).expect(403);
      await asAdmin(request(app.getHttpServer()).post('/api/v1/farmers')).send(validFarmerPayload()).expect(403);
    });

    it('rejects a WAREHOUSE_STAFF caller — this route is VENDOR_OWNER only', async () => {
      await asStaffA(request(app.getHttpServer()).get('/api/v1/farmers')).expect(403);
      await asStaffA(request(app.getHttpServer()).post('/api/v1/farmers')).send(validFarmerPayload()).expect(403);
    });
  });

  describe('POST /farmers — validation', () => {
    it('rejects missing required fields, reporting "should not be empty" first', async () => {
      const res = await asOwnerA(request(app.getHttpServer()).post('/api/v1/farmers')).send({}).expect(400);
      expect(res.body.fields.name).toBeDefined();
      expect(res.body.fields.phone).toBeDefined();
      expect(res.body.fields.name[0]).toBe('name should not be empty');
      expect(res.body.fields.phone[0]).toBe('phone should not be empty');
    });

    it('rejects a name shorter than 2, longer than 255, or non-string', async () => {
      await createFarmerAsOwnerA({ name: 'X' }).expect(400);
      await createFarmerAsOwnerA({ name: 'A'.repeat(256) }).expect(400);
      await createFarmerAsOwnerA({ name: 12345 }).expect(400);
    });

    it('rejects a malformed phone number', async () => {
      const res = await createFarmerAsOwnerA({ phone: '123' }).expect(400);
      expect(res.body.fields.phone).toBeDefined();
    });

    it('rejects unknown fields on the DTO', () => {
      return createFarmerAsOwnerA({ not_a_real_field: 'x' }).expect(400);
    });

    it('creates successfully without the optional location/bank_account fields', async () => {
      const res = await asOwnerA(request(app.getHttpServer()).post('/api/v1/farmers'))
        .send({ name: 'No Optionals', phone: `+9198760${++uniqueCounter}` })
        .expect(201);
      expect(res.body.data.location).toBeNull();
      expect(res.body.data.bank_account).toBeNull();
    });
  });

  describe('POST /farmers — happy path', () => {
    it('creates a farmer scoped to the caller\'s own vendor', async () => {
      const res = await createFarmerAsOwnerA().expect(201);

      expect(res.body.status).toBe(true);
      expect(res.body.message).toBe('Farmer created successfully');
      const farmer = res.body.data;
      expect(farmer.id_farmer).toBeUndefined(); // internal numeric PK must never leak
      expect(farmer.public_id).toBeDefined();
      expect(farmer.vendor_id).toBe(vendorA.id_vendor);
      expect(farmer.is_active).toBe(true);
    });

    it('trims the name before saving', async () => {
      const res = await createFarmerAsOwnerA({ name: '  Padded Name  ' }).expect(201);
      expect(res.body.data.name).toBe('Padded Name');
    });
  });

  describe('GET /farmers — list', () => {
    it("lists only the caller's own vendor's farmers", async () => {
      const created = await createFarmerAsOwnerA().expect(201);

      const ownerAList = await asOwnerA(request(app.getHttpServer()).get('/api/v1/farmers')).expect(200);
      expect(ownerAList.body.data.some((f: any) => f.public_id === created.body.data.public_id)).toBe(true);

      const ownerBList = await asOwnerB(request(app.getHttpServer()).get('/api/v1/farmers')).expect(200);
      expect(ownerBList.body.data.some((f: any) => f.public_id === created.body.data.public_id)).toBe(false);
    });
  });

  describe('GET /farmers/:id', () => {
    it('rejects an unauthenticated request', async () => {
      const created = await createFarmerAsOwnerA().expect(201);
      await request(app.getHttpServer()).get(`/api/v1/farmers/${created.body.data.public_id}`).expect(401);
    });

    it('fetches a farmer by public_id for its own vendor', async () => {
      const created = await createFarmerAsOwnerA().expect(201);
      const res = await asOwnerA(
        request(app.getHttpServer()).get(`/api/v1/farmers/${created.body.data.public_id}`),
      ).expect(200);
      expect(res.body.data.public_id).toBe(created.body.data.public_id);
    });

    it('404s on an unknown (but well-formed) farmer id', () => {
      return asOwnerA(
        request(app.getHttpServer()).get('/api/v1/farmers/00000000-0000-0000-0000-000000000000'),
      ).expect(404);
    });

    it("404s (not 403) a request for another vendor's farmer id — cross-tenant lookup must not confirm existence", async () => {
      const created = await createFarmerAsOwnerA().expect(201);
      await asOwnerB(
        request(app.getHttpServer()).get(`/api/v1/farmers/${created.body.data.public_id}`),
      ).expect(404);
    });
  });

  describe('PATCH /farmers/:id', () => {
    it('rejects an unauthenticated request', async () => {
      const created = await createFarmerAsOwnerA().expect(201);
      await request(app.getHttpServer())
        .patch(`/api/v1/farmers/${created.body.data.public_id}`)
        .send(validFarmerPayload())
        .expect(401);
    });

    it('updates a farmer and persists the change', async () => {
      const created = await createFarmerAsOwnerA().expect(201);

      const res = await asOwnerA(request(app.getHttpServer()).patch(`/api/v1/farmers/${created.body.data.public_id}`))
        .send(validFarmerPayload({ name: 'Updated Name' }))
        .expect(200);
      expect(res.body.data.name).toBe('Updated Name');

      const refetched = await asOwnerA(
        request(app.getHttpServer()).get(`/api/v1/farmers/${created.body.data.public_id}`),
      ).expect(200);
      expect(refetched.body.data.name).toBe('Updated Name');
    });

    it('404s on an unknown farmer id', () => {
      return asOwnerA(request(app.getHttpServer()).patch('/api/v1/farmers/00000000-0000-0000-0000-000000000000'))
        .send(validFarmerPayload())
        .expect(404);
    });

    it("404s (not 403) updating another vendor's farmer — cross-tenant update is blocked", async () => {
      const created = await createFarmerAsOwnerA().expect(201);
      await asOwnerB(request(app.getHttpServer()).patch(`/api/v1/farmers/${created.body.data.public_id}`))
        .send(validFarmerPayload({ name: 'Hijacked Name' }))
        .expect(404);

      // vendor A's farmer must be untouched by the rejected attempt
      const refetched = await asOwnerA(
        request(app.getHttpServer()).get(`/api/v1/farmers/${created.body.data.public_id}`),
      ).expect(200);
      expect(refetched.body.data.name).not.toBe('Hijacked Name');
    });

    it('rejects missing required fields on update', async () => {
      const created = await createFarmerAsOwnerA().expect(201);
      const res = await asOwnerA(request(app.getHttpServer()).patch(`/api/v1/farmers/${created.body.data.public_id}`))
        .send({})
        .expect(400);
      expect(res.body.fields.name).toBeDefined();
      expect(res.body.fields.phone).toBeDefined();
    });
  });
});
