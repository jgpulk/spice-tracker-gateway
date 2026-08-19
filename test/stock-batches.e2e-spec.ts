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
import { StockBatch } from '../src/modules/stock-batches/entities/stock-batch.entity';
import { BatchStatus } from '../src/common/enums/batch-status.enum';

describe('Stock Batches — /api/v1/stock-batches (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let farmerRepo: Repository<Farmer>;
  let batchRepo: Repository<StockBatch>;

  let ownerAToken: string;
  let ownerBToken: string;
  let staffAToken: string;
  let superAdminToken: string;
  let vendorA: Vendor;
  let vendorB: Vendor;
  let farmerA: Farmer;
  let farmerB: Farmer;

  const ADMIN_EMAIL = 'e2e-batches-admin@spicewallet.test';
  const ADMIN_PASSWORD = 'AdminPass123!';
  const OWNER_A_EMAIL = 'e2e-batches-owner-a@spicewallet.test';
  const OWNER_A_PASSWORD = 'OwnerAPass123!';
  const OWNER_B_EMAIL = 'e2e-batches-owner-b@spicewallet.test';
  const OWNER_B_PASSWORD = 'OwnerBPass123!';
  const STAFF_A_EMAIL = 'e2e-batches-staff-a@spicewallet.test';
  const STAFF_A_PASSWORD = 'StaffAPass123!';

  const asOwnerA = (req: request.Test) => req.set('Authorization', `Bearer ${ownerAToken}`);
  const asOwnerB = (req: request.Test) => req.set('Authorization', `Bearer ${ownerBToken}`);
  const asStaffA = (req: request.Test) => req.set('Authorization', `Bearer ${staffAToken}`);
  const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${superAdminToken}`);

  const validBatchPayload = (overrides: Record<string, unknown> = {}) => ({
    farmer_public_id: farmerA.public_id,
    raw_weight_kg: 120.5,
    price_per_kg: 85.0,
    ...overrides,
  });

  const login = async (email: string, password: string) =>
    (
      await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(201)
    ).body.data.access_token;

  const createBatchAsOwnerA = (overrides: Record<string, unknown> = {}) =>
    asOwnerA(request(app.getHttpServer()).post('/api/v1/stock-batches')).send(validBatchPayload(overrides));

  beforeAll(async () => {
    const { app: testApp, moduleFixture } = await createTestApp();
    app = testApp;

    userRepo = moduleFixture.get(getRepositoryToken(User));
    vendorRepo = moduleFixture.get(getRepositoryToken(Vendor));
    farmerRepo = moduleFixture.get(getRepositoryToken(Farmer));
    batchRepo = moduleFixture.get(getRepositoryToken(StockBatch));

    await batchRepo.query('SET FOREIGN_KEY_CHECKS = 0');
    await batchRepo.query('TRUNCATE TABLE stock_batches');
    await farmerRepo.query('TRUNCATE TABLE farmers');
    await vendorRepo.query('TRUNCATE TABLE vendors');
    await userRepo.query('TRUNCATE TABLE users');
    await batchRepo.query('SET FOREIGN_KEY_CHECKS = 1');

    await userRepo.save(
      userRepo.create({
        name: 'E2E Batches Admin',
        email: ADMIN_EMAIL,
        password_hash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        role: Role.SUPER_ADMIN,
        vendor_id: null,
        is_active: true,
      }),
    );

    vendorA = await vendorRepo.save(
      vendorRepo.create({
        name: 'Batches Test Shop A',
        subdomain: 'batches-test-shop-a',
        email: 'shop-batches-a@example.com',
        phone: '+919876500001',
        address: '1, Test Street',
        city: 'Kochi',
        state: 'Kerala',
        country: 'India',
        pincode: '682001',
        business_reg_no: '29ABCDEBATA1Z5',
        business_type: 'Sole Proprietorship',
        status: VendorStatus.ACTIVE,
      }),
    );
    vendorB = await vendorRepo.save(
      vendorRepo.create({
        name: 'Batches Test Shop B',
        subdomain: 'batches-test-shop-b',
        email: 'shop-batches-b@example.com',
        phone: '+919876500002',
        address: '2, Test Street',
        city: 'Kochi',
        state: 'Kerala',
        country: 'India',
        pincode: '682002',
        business_reg_no: '29ABCDEBATB1Z5',
        business_type: 'Partnership',
        status: VendorStatus.ACTIVE,
      }),
    );

    farmerA = await farmerRepo.save(
      farmerRepo.create({ vendor_id: vendorA.id_vendor, name: 'Farmer A', phone: '+919876511111' }),
    );
    farmerB = await farmerRepo.save(
      farmerRepo.create({ vendor_id: vendorB.id_vendor, name: 'Farmer B', phone: '+919876522222' }),
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
    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer()).get('/api/v1/stock-batches').expect(401);
      await request(app.getHttpServer()).post('/api/v1/stock-batches').send(validBatchPayload()).expect(401);
    });

    it('rejects a SUPER_ADMIN caller', async () => {
      await asAdmin(request(app.getHttpServer()).get('/api/v1/stock-batches')).expect(403);
    });

    it('allows both VENDOR_OWNER and WAREHOUSE_STAFF', async () => {
      await asOwnerA(request(app.getHttpServer()).get('/api/v1/stock-batches')).expect(200);
      await asStaffA(request(app.getHttpServer()).get('/api/v1/stock-batches')).expect(200);
    });
  });

  describe('POST /stock-batches — validation', () => {
    it('rejects missing required fields, reporting "should not be empty" first', async () => {
      const res = await asOwnerA(request(app.getHttpServer()).post('/api/v1/stock-batches')).send({}).expect(400);
      expect(res.body.fields.farmer_public_id[0]).toBe('farmer_public_id should not be empty');
      expect(res.body.fields.raw_weight_kg[0]).toBe('raw_weight_kg should not be empty');
      expect(res.body.fields.price_per_kg[0]).toBe('price_per_kg should not be empty');
    });

    it('rejects a malformed (non-UUID) farmer_public_id', async () => {
      const res = await createBatchAsOwnerA({ farmer_public_id: 'not-a-uuid' }).expect(400);
      expect(res.body.fields.farmer_public_id).toBeDefined();
    });

    it('rejects a non-positive raw_weight_kg or price_per_kg', async () => {
      await createBatchAsOwnerA({ raw_weight_kg: 0 }).expect(400);
      await createBatchAsOwnerA({ raw_weight_kg: -5 }).expect(400);
      await createBatchAsOwnerA({ price_per_kg: 0 }).expect(400);
      await createBatchAsOwnerA({ price_per_kg: -5 }).expect(400);
    });

    it('rejects unknown fields on the DTO', () => {
      return createBatchAsOwnerA({ not_a_real_field: 'x' }).expect(400);
    });

    it("404s on a farmer_public_id that doesn't belong to the caller's vendor", async () => {
      await createBatchAsOwnerA({ farmer_public_id: farmerB.public_id }).expect(404);
    });

    it('404s on an unknown farmer_public_id', async () => {
      await createBatchAsOwnerA({ farmer_public_id: '00000000-0000-0000-0000-000000000000' }).expect(404);
    });
  });

  describe('POST /stock-batches — happy path', () => {
    it('creates a batch with status RECEIVED, scoped to the caller\'s vendor', async () => {
      const res = await createBatchAsOwnerA().expect(201);

      const batch = res.body.data;
      expect(batch.id_stock_batch).toBeUndefined(); // internal numeric PK must never leak
      expect(batch.public_id).toBeDefined();
      expect(batch.status).toBe(BatchStatus.RECEIVED);
      expect(batch.vendor_id).toBe(vendorA.id_vendor);
      expect(batch.farmer_id).toBe(farmerA.id_farmer);
      expect(Number(batch.raw_weight_kg)).toBe(120.5);
      expect(Number(batch.price_per_kg)).toBe(85.0);
    });

    it('lets a WAREHOUSE_STAFF create a batch too', async () => {
      const res = await asStaffA(request(app.getHttpServer()).post('/api/v1/stock-batches'))
        .send(validBatchPayload())
        .expect(201);
      expect(res.body.data.vendor_id).toBe(vendorA.id_vendor);
    });
  });

  describe('GET /stock-batches — list', () => {
    it("lists only the caller's own vendor's batches", async () => {
      const created = await createBatchAsOwnerA().expect(201);

      const ownerAList = await asOwnerA(request(app.getHttpServer()).get('/api/v1/stock-batches')).expect(200);
      expect(ownerAList.body.data.some((b: any) => b.public_id === created.body.data.public_id)).toBe(true);

      const ownerBList = await asOwnerB(request(app.getHttpServer()).get('/api/v1/stock-batches')).expect(200);
      expect(ownerBList.body.data.some((b: any) => b.public_id === created.body.data.public_id)).toBe(false);
    });

    it('includes the related farmer', async () => {
      const created = await createBatchAsOwnerA().expect(201);
      const list = await asOwnerA(request(app.getHttpServer()).get('/api/v1/stock-batches')).expect(200);
      const item = list.body.data.find((b: any) => b.public_id === created.body.data.public_id);
      expect(item.farmer).toBeDefined();
      expect(item.farmer.public_id).toBe(farmerA.public_id);
    });
  });

  describe('GET /stock-batches/:id', () => {
    it('404s on an unknown (but well-formed) batch id', () => {
      return asOwnerA(
        request(app.getHttpServer()).get('/api/v1/stock-batches/00000000-0000-0000-0000-000000000000'),
      ).expect(404);
    });

    it("404s (not 403) a request for another vendor's batch id — cross-tenant lookup must not confirm existence", async () => {
      const created = await createBatchAsOwnerA().expect(201);
      await asOwnerB(
        request(app.getHttpServer()).get(`/api/v1/stock-batches/${created.body.data.public_id}`),
      ).expect(404);
    });
  });
});
