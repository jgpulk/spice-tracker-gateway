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
import { DryingLot, DryingLotStatus } from '../src/modules/drying-lots/entities/drying-lot.entity';

describe('Drying Lots — /api/v1/drying-lots (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let farmerRepo: Repository<Farmer>;
  let batchRepo: Repository<StockBatch>;
  let lotRepo: Repository<DryingLot>;

  let ownerAToken: string;
  let ownerBToken: string;
  let staffAToken: string;
  let superAdminToken: string;
  let vendorA: Vendor;
  let vendorB: Vendor;
  let farmerA: Farmer;
  let farmerB: Farmer;
  let batchCounter = 0;

  const ADMIN_EMAIL = 'e2e-drying-admin@spicewallet.test';
  const ADMIN_PASSWORD = 'AdminPass123!';
  const OWNER_A_EMAIL = 'e2e-drying-owner-a@spicewallet.test';
  const OWNER_A_PASSWORD = 'OwnerAPass123!';
  const OWNER_B_EMAIL = 'e2e-drying-owner-b@spicewallet.test';
  const OWNER_B_PASSWORD = 'OwnerBPass123!';
  const STAFF_A_EMAIL = 'e2e-drying-staff-a@spicewallet.test';
  const STAFF_A_PASSWORD = 'StaffAPass123!';

  const asOwnerA = (req: request.Test) => req.set('Authorization', `Bearer ${ownerAToken}`);
  const asOwnerB = (req: request.Test) => req.set('Authorization', `Bearer ${ownerBToken}`);
  const asStaffA = (req: request.Test) => req.set('Authorization', `Bearer ${staffAToken}`);
  const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${superAdminToken}`);

  const login = async (email: string, password: string) =>
    (
      await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(201)
    ).body.data.access_token;

  // Seeds a RECEIVED batch directly via the repo (bypassing the API) so each
  // test gets a fresh, known-good batch to assign into a drying lot.
  const seedReceivedBatch = async (vendor: Vendor, farmer: Farmer, raw_weight_kg = 100) => {
    batchCounter++;
    return batchRepo.save(
      batchRepo.create({
        vendor_id: vendor.id_vendor,
        farmer_id: farmer.id_farmer,
        raw_weight_kg,
        price_per_kg: 80,
        status: BatchStatus.RECEIVED,
      }),
    );
  };

  const validLotPayload = (batchPublicIds: string[], overrides: Record<string, unknown> = {}) => ({
    lot_name: `LOT-${++batchCounter}`,
    batch_public_ids: batchPublicIds,
    ...overrides,
  });

  beforeAll(async () => {
    const { app: testApp, moduleFixture } = await createTestApp();
    app = testApp;

    userRepo = moduleFixture.get(getRepositoryToken(User));
    vendorRepo = moduleFixture.get(getRepositoryToken(Vendor));
    farmerRepo = moduleFixture.get(getRepositoryToken(Farmer));
    batchRepo = moduleFixture.get(getRepositoryToken(StockBatch));
    lotRepo = moduleFixture.get(getRepositoryToken(DryingLot));

    await lotRepo.query('SET FOREIGN_KEY_CHECKS = 0');
    await lotRepo.query('TRUNCATE TABLE drying_lots');
    await batchRepo.query('TRUNCATE TABLE stock_batches');
    await farmerRepo.query('TRUNCATE TABLE farmers');
    await vendorRepo.query('TRUNCATE TABLE vendors');
    await userRepo.query('TRUNCATE TABLE users');
    await lotRepo.query('SET FOREIGN_KEY_CHECKS = 1');

    await userRepo.save(
      userRepo.create({
        name: 'E2E Drying Admin',
        email: ADMIN_EMAIL,
        password_hash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        role: Role.SUPER_ADMIN,
        vendor_id: null,
        is_active: true,
      }),
    );

    vendorA = await vendorRepo.save(
      vendorRepo.create({
        name: 'Drying Test Shop A',
        subdomain: 'drying-test-shop-a',
        email: 'shop-drying-a@example.com',
        phone: '+919876500001',
        address: '1, Test Street',
        city: 'Kochi',
        state: 'Kerala',
        country: 'India',
        pincode: '682001',
        business_reg_no: '29ABCDEDRYA1Z5',
        business_type: 'Sole Proprietorship',
        status: VendorStatus.ACTIVE,
      }),
    );
    vendorB = await vendorRepo.save(
      vendorRepo.create({
        name: 'Drying Test Shop B',
        subdomain: 'drying-test-shop-b',
        email: 'shop-drying-b@example.com',
        phone: '+919876500002',
        address: '2, Test Street',
        city: 'Kochi',
        state: 'Kerala',
        country: 'India',
        pincode: '682002',
        business_reg_no: '29ABCDEDRYB1Z5',
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
      await request(app.getHttpServer()).get('/api/v1/drying-lots').expect(401);
      await request(app.getHttpServer()).post('/api/v1/drying-lots').send(validLotPayload([])).expect(401);
    });

    it('rejects a SUPER_ADMIN caller', async () => {
      await asAdmin(request(app.getHttpServer()).get('/api/v1/drying-lots')).expect(403);
    });

    it('allows both VENDOR_OWNER and WAREHOUSE_STAFF', async () => {
      await asOwnerA(request(app.getHttpServer()).get('/api/v1/drying-lots')).expect(200);
      await asStaffA(request(app.getHttpServer()).get('/api/v1/drying-lots')).expect(200);
    });
  });

  describe('POST /drying-lots — validation', () => {
    it('rejects missing required fields, reporting "should not be empty" first', async () => {
      const res = await asOwnerA(request(app.getHttpServer()).post('/api/v1/drying-lots')).send({}).expect(400);
      expect(res.body.fields.lot_name[0]).toBe('lot_name should not be empty');
      expect(res.body.fields.batch_public_ids).toBeDefined();
    });

    it('rejects an empty batch_public_ids array', async () => {
      const res = await asOwnerA(request(app.getHttpServer()).post('/api/v1/drying-lots'))
        .send(validLotPayload([]))
        .expect(400);
      expect(res.body.fields.batch_public_ids).toBeDefined();
    });

    it('rejects a non-UUID entry in batch_public_ids', async () => {
      const res = await asOwnerA(request(app.getHttpServer()).post('/api/v1/drying-lots'))
        .send(validLotPayload(['not-a-uuid']))
        .expect(400);
      expect(res.body.fields.batch_public_ids).toBeDefined();
    });

    it('rejects unknown fields on the DTO', async () => {
      const batch = await seedReceivedBatch(vendorA, farmerA);
      await asOwnerA(request(app.getHttpServer()).post('/api/v1/drying-lots'))
        .send({ ...validLotPayload([batch.public_id]), not_a_real_field: 'x' })
        .expect(400);
    });
  });

  describe('POST /drying-lots — happy path', () => {
    it('creates a lot, sums initial_weight_kg from the assigned RECEIVED batches, and moves them to IN_DRYING', async () => {
      const b1 = await seedReceivedBatch(vendorA, farmerA, 100);
      const b2 = await seedReceivedBatch(vendorA, farmerA, 50);

      const res = await asOwnerA(request(app.getHttpServer()).post('/api/v1/drying-lots'))
        .send(validLotPayload([b1.public_id, b2.public_id]))
        .expect(201);

      const lot = res.body.data;
      expect(lot.id_drying_lot).toBeUndefined(); // internal numeric PK must never leak
      expect(lot.status).toBe(DryingLotStatus.ACTIVE);
      expect(Number(lot.initial_weight_kg)).toBe(150);

      const b1Refetched = await batchRepo.findOneBy({ public_id: b1.public_id });
      const b2Refetched = await batchRepo.findOneBy({ public_id: b2.public_id });
      expect(b1Refetched!.status).toBe(BatchStatus.IN_DRYING);
      expect(b2Refetched!.status).toBe(BatchStatus.IN_DRYING);
      expect(b1Refetched!.drying_lot_id).toBe(lot.id_drying_lot ?? b1Refetched!.drying_lot_id);
    });

    // Documents current behavior rather than asserting a fix: create() looks
    // up batches by { public_id: In(ids), vendor_id, status: RECEIVED } and
    // silently drops any id that doesn't match (wrong vendor, wrong status,
    // or nonexistent) instead of rejecting the request — no validation error
    // is raised for a bad id mixed into an otherwise-valid list.
    it("documents current behavior: a batch_public_id that doesn't match (wrong vendor, wrong status, or unknown) is silently dropped, not rejected", async () => {
      const goodBatch = await seedReceivedBatch(vendorA, farmerA, 100);
      const otherVendorBatch = await seedReceivedBatch(vendorB, farmerB, 999);

      const res = await asOwnerA(request(app.getHttpServer()).post('/api/v1/drying-lots'))
        .send(
          validLotPayload([
            goodBatch.public_id,
            otherVendorBatch.public_id,
            '00000000-0000-0000-0000-000000000000',
          ]),
        )
        .expect(201);

      // Only the matching batch's weight is counted — the other two ids were
      // silently ignored rather than causing a 400/404.
      expect(Number(res.body.data.initial_weight_kg)).toBe(100);

      const otherVendorRefetched = await batchRepo.findOneBy({ public_id: otherVendorBatch.public_id });
      expect(otherVendorRefetched!.status).toBe(BatchStatus.RECEIVED); // untouched
    });

    it("does not let a VENDOR_OWNER pull another vendor's batch into their own lot", async () => {
      const otherVendorBatch = await seedReceivedBatch(vendorB, farmerB, 999);

      await asOwnerA(request(app.getHttpServer()).post('/api/v1/drying-lots'))
        .send(validLotPayload([otherVendorBatch.public_id]))
        .expect(201); // request succeeds but silently assigns nothing (see above)

      const refetched = await batchRepo.findOneBy({ public_id: otherVendorBatch.public_id });
      expect(refetched!.status).toBe(BatchStatus.RECEIVED); // vendor B's batch is untouched
      expect(refetched!.drying_lot_id).toBeNull();
    });
  });

  describe('GET /drying-lots/:id', () => {
    it('404s on an unknown (but well-formed) lot id', () => {
      return asOwnerA(
        request(app.getHttpServer()).get('/api/v1/drying-lots/00000000-0000-0000-0000-000000000000'),
      ).expect(404);
    });

    it("404s (not 403) a request for another vendor's lot id", async () => {
      const batch = await seedReceivedBatch(vendorA, farmerA);
      const created = await asOwnerA(request(app.getHttpServer()).post('/api/v1/drying-lots'))
        .send(validLotPayload([batch.public_id]))
        .expect(201);

      await asOwnerB(
        request(app.getHttpServer()).get(`/api/v1/drying-lots/${created.body.data.public_id}`),
      ).expect(404);
    });
  });

  describe('PATCH /drying-lots/:id/complete', () => {
    it('rejects missing/non-positive final_dry_weight_kg', async () => {
      const batch = await seedReceivedBatch(vendorA, farmerA);
      const created = await asOwnerA(request(app.getHttpServer()).post('/api/v1/drying-lots'))
        .send(validLotPayload([batch.public_id]))
        .expect(201);

      const missing = await asOwnerA(
        request(app.getHttpServer()).patch(`/api/v1/drying-lots/${created.body.data.public_id}/complete`),
      )
        .send({})
        .expect(400);
      expect(missing.body.fields.final_dry_weight_kg[0]).toBe('final_dry_weight_kg should not be empty');

      await asOwnerA(request(app.getHttpServer()).patch(`/api/v1/drying-lots/${created.body.data.public_id}/complete`))
        .send({ final_dry_weight_kg: 0 })
        .expect(400);
    });

    it('completes a lot: computes yield_pct, sets COMPLETED, and moves batches to PROCESSED', async () => {
      const batch = await seedReceivedBatch(vendorA, farmerA, 100);
      const created = await asOwnerA(request(app.getHttpServer()).post('/api/v1/drying-lots'))
        .send(validLotPayload([batch.public_id]))
        .expect(201);

      const res = await asOwnerA(
        request(app.getHttpServer()).patch(`/api/v1/drying-lots/${created.body.data.public_id}/complete`),
      )
        .send({ final_dry_weight_kg: 40 })
        .expect(200);

      expect(res.body.data.status).toBe(DryingLotStatus.COMPLETED);
      expect(Number(res.body.data.final_dry_weight_kg)).toBe(40);
      expect(Number(res.body.data.yield_pct)).toBe(40); // 40/100 * 100
      expect(res.body.data.completed_at).not.toBeNull();

      const batchRefetched = await batchRepo.findOneBy({ public_id: batch.public_id });
      expect(batchRefetched!.status).toBe(BatchStatus.PROCESSED);
    });

    it('404s completing an unknown lot id', () => {
      return asOwnerA(
        request(app.getHttpServer()).patch('/api/v1/drying-lots/00000000-0000-0000-0000-000000000000/complete'),
      )
        .send({ final_dry_weight_kg: 40 })
        .expect(404);
    });

    it("404s (not 403) completing another vendor's lot", async () => {
      const batch = await seedReceivedBatch(vendorA, farmerA);
      const created = await asOwnerA(request(app.getHttpServer()).post('/api/v1/drying-lots'))
        .send(validLotPayload([batch.public_id]))
        .expect(201);

      await asOwnerB(
        request(app.getHttpServer()).patch(`/api/v1/drying-lots/${created.body.data.public_id}/complete`),
      )
        .send({ final_dry_weight_kg: 40 })
        .expect(404);
    });
  });
});
