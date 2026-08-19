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
import { FarmerPayout, PayoutStatus } from '../src/modules/farmer-payouts/entities/farmer-payout.entity';

describe('Farmer Payouts — /api/v1/farmer-payouts (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let farmerRepo: Repository<Farmer>;
  let batchRepo: Repository<StockBatch>;
  let payoutRepo: Repository<FarmerPayout>;

  let ownerAToken: string;
  let ownerBToken: string;
  let staffAToken: string;
  let superAdminToken: string;
  let vendorA: Vendor;
  let vendorB: Vendor;
  let farmerA: Farmer;
  let farmerB: Farmer;
  let batchA: StockBatch;
  let batchB: StockBatch;

  const ADMIN_EMAIL = 'e2e-payouts-admin@spicewallet.test';
  const ADMIN_PASSWORD = 'AdminPass123!';
  const OWNER_A_EMAIL = 'e2e-payouts-owner-a@spicewallet.test';
  const OWNER_A_PASSWORD = 'OwnerAPass123!';
  const OWNER_B_EMAIL = 'e2e-payouts-owner-b@spicewallet.test';
  const OWNER_B_PASSWORD = 'OwnerBPass123!';
  const STAFF_A_EMAIL = 'e2e-payouts-staff-a@spicewallet.test';
  const STAFF_A_PASSWORD = 'StaffAPass123!';

  const asOwnerA = (req: request.Test) => req.set('Authorization', `Bearer ${ownerAToken}`);
  const asOwnerB = (req: request.Test) => req.set('Authorization', `Bearer ${ownerBToken}`);
  const asStaffA = (req: request.Test) => req.set('Authorization', `Bearer ${staffAToken}`);
  const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${superAdminToken}`);

  const login = async (email: string, password: string) =>
    (
      await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(201)
    ).body.data.access_token;

  const validPayoutPayload = (overrides: Record<string, unknown> = {}) => ({
    farmer_public_id: farmerA.public_id,
    batch_public_id: batchA.public_id,
    amount: 10225.0,
    ...overrides,
  });

  const createPayoutAsOwnerA = (overrides: Record<string, unknown> = {}) =>
    asOwnerA(request(app.getHttpServer()).post('/api/v1/farmer-payouts')).send(validPayoutPayload(overrides));

  beforeAll(async () => {
    const { app: testApp, moduleFixture } = await createTestApp();
    app = testApp;

    userRepo = moduleFixture.get(getRepositoryToken(User));
    vendorRepo = moduleFixture.get(getRepositoryToken(Vendor));
    farmerRepo = moduleFixture.get(getRepositoryToken(Farmer));
    batchRepo = moduleFixture.get(getRepositoryToken(StockBatch));
    payoutRepo = moduleFixture.get(getRepositoryToken(FarmerPayout));

    await payoutRepo.query('SET FOREIGN_KEY_CHECKS = 0');
    await payoutRepo.query('TRUNCATE TABLE farmer_payouts');
    await batchRepo.query('TRUNCATE TABLE stock_batches');
    await farmerRepo.query('TRUNCATE TABLE farmers');
    await vendorRepo.query('TRUNCATE TABLE vendors');
    await userRepo.query('TRUNCATE TABLE users');
    await payoutRepo.query('SET FOREIGN_KEY_CHECKS = 1');

    await userRepo.save(
      userRepo.create({
        name: 'E2E Payouts Admin',
        email: ADMIN_EMAIL,
        password_hash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        role: Role.SUPER_ADMIN,
        vendor_id: null,
        is_active: true,
      }),
    );

    vendorA = await vendorRepo.save(
      vendorRepo.create({
        name: 'Payouts Test Shop A',
        subdomain: 'payouts-test-shop-a',
        email: 'shop-payouts-a@example.com',
        phone: '+919876500001',
        address: '1, Test Street',
        city: 'Kochi',
        state: 'Kerala',
        country: 'India',
        pincode: '682001',
        business_reg_no: '29ABCDEPAYA1Z5',
        business_type: 'Sole Proprietorship',
        status: VendorStatus.ACTIVE,
      }),
    );
    vendorB = await vendorRepo.save(
      vendorRepo.create({
        name: 'Payouts Test Shop B',
        subdomain: 'payouts-test-shop-b',
        email: 'shop-payouts-b@example.com',
        phone: '+919876500002',
        address: '2, Test Street',
        city: 'Kochi',
        state: 'Kerala',
        country: 'India',
        pincode: '682002',
        business_reg_no: '29ABCDEPAYB1Z5',
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

    batchA = await batchRepo.save(
      batchRepo.create({ vendor_id: vendorA.id_vendor, farmer_id: farmerA.id_farmer, raw_weight_kg: 120, price_per_kg: 85 }),
    );
    batchB = await batchRepo.save(
      batchRepo.create({ vendor_id: vendorB.id_vendor, farmer_id: farmerB.id_farmer, raw_weight_kg: 120, price_per_kg: 85 }),
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
      await request(app.getHttpServer()).get('/api/v1/farmer-payouts').expect(401);
      await request(app.getHttpServer()).post('/api/v1/farmer-payouts').send(validPayoutPayload()).expect(401);
    });

    it('rejects a SUPER_ADMIN caller — this route is VENDOR_OWNER only', async () => {
      await asAdmin(request(app.getHttpServer()).get('/api/v1/farmer-payouts')).expect(403);
    });

    it('rejects a WAREHOUSE_STAFF caller — this route is VENDOR_OWNER only', async () => {
      await asStaffA(request(app.getHttpServer()).get('/api/v1/farmer-payouts')).expect(403);
    });
  });

  describe('POST /farmer-payouts — validation', () => {
    it('rejects missing required fields, reporting "should not be empty" first', async () => {
      const res = await asOwnerA(request(app.getHttpServer()).post('/api/v1/farmer-payouts')).send({}).expect(400);
      expect(res.body.fields.farmer_public_id[0]).toBe('farmer_public_id should not be empty');
      expect(res.body.fields.batch_public_id[0]).toBe('batch_public_id should not be empty');
      expect(res.body.fields.amount[0]).toBe('amount should not be empty');
    });

    it('rejects a non-positive amount', async () => {
      await createPayoutAsOwnerA({ amount: 0 }).expect(400);
      await createPayoutAsOwnerA({ amount: -100 }).expect(400);
    });

    it('rejects malformed (non-UUID) farmer_public_id/batch_public_id', async () => {
      await createPayoutAsOwnerA({ farmer_public_id: 'not-a-uuid' }).expect(400);
      await createPayoutAsOwnerA({ batch_public_id: 'not-a-uuid' }).expect(400);
    });

    it('rejects unknown fields on the DTO', () => {
      return createPayoutAsOwnerA({ not_a_real_field: 'x' }).expect(400);
    });

    it("404s on a farmer_public_id that doesn't belong to the caller's vendor", async () => {
      await createPayoutAsOwnerA({ farmer_public_id: farmerB.public_id }).expect(404);
    });

    it("404s on a batch_public_id that doesn't belong to the caller's vendor", async () => {
      await createPayoutAsOwnerA({ batch_public_id: batchB.public_id }).expect(404);
    });

    it('404s on unknown farmer_public_id / batch_public_id', async () => {
      await createPayoutAsOwnerA({ farmer_public_id: '00000000-0000-0000-0000-000000000000' }).expect(404);
      await createPayoutAsOwnerA({ batch_public_id: '00000000-0000-0000-0000-000000000000' }).expect(404);
    });
  });

  describe('POST /farmer-payouts — happy path', () => {
    it('creates a payout with status PENDING, scoped to the caller\'s vendor', async () => {
      const res = await createPayoutAsOwnerA().expect(201);

      const payout = res.body.data;
      expect(payout.id_farmer_payout).toBeUndefined(); // internal numeric PK must never leak
      expect(payout.vendor_id).toBe(vendorA.id_vendor);
      expect(payout.farmer_id).toBe(farmerA.id_farmer);
      expect(payout.batch_id).toBe(batchA.id_stock_batch);
      expect(payout.status).toBe(PayoutStatus.PENDING);
      expect(Number(payout.amount)).toBe(10225.0);
      expect(payout.paid_at).toBeNull();
    });

    it('accepts an optional due_date', async () => {
      const res = await createPayoutAsOwnerA({ due_date: '2024-12-31' }).expect(201);
      expect(res.body.data.due_date).toMatch(/^2024-12-31/);
    });
  });

  describe('GET /farmer-payouts — list', () => {
    it("lists only the caller's own vendor's payouts", async () => {
      const created = await createPayoutAsOwnerA().expect(201);

      const ownerAList = await asOwnerA(request(app.getHttpServer()).get('/api/v1/farmer-payouts')).expect(200);
      expect(ownerAList.body.data.some((p: any) => p.public_id === created.body.data.public_id)).toBe(true);

      const ownerBList = await asOwnerB(request(app.getHttpServer()).get('/api/v1/farmer-payouts')).expect(200);
      expect(ownerBList.body.data.some((p: any) => p.public_id === created.body.data.public_id)).toBe(false);
    });
  });

  describe('PATCH /farmer-payouts/:id/pay', () => {
    it('marks a payout PAID and stamps paid_at', async () => {
      const created = await createPayoutAsOwnerA().expect(201);

      const res = await asOwnerA(
        request(app.getHttpServer()).patch(`/api/v1/farmer-payouts/${created.body.data.public_id}/pay`),
      ).expect(200);
      expect(res.body.data.status).toBe(PayoutStatus.PAID);
      expect(res.body.data.paid_at).not.toBeNull();
    });

    it('404s marking an unknown payout id as paid', () => {
      return asOwnerA(
        request(app.getHttpServer()).patch('/api/v1/farmer-payouts/00000000-0000-0000-0000-000000000000/pay'),
      ).expect(404);
    });

    it("404s (not 403) marking another vendor's payout as paid", async () => {
      const created = await createPayoutAsOwnerA().expect(201);
      await asOwnerB(
        request(app.getHttpServer()).patch(`/api/v1/farmer-payouts/${created.body.data.public_id}/pay`),
      ).expect(404);
    });
  });
});
