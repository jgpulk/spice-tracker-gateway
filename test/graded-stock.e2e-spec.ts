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
import { DryingLot } from '../src/modules/drying-lots/entities/drying-lot.entity';
import { GradedStock } from '../src/modules/graded-stock/entities/graded-stock.entity';
import { Grade } from '../src/common/enums/grade.enum';

describe('Graded Stock — /api/v1/graded-stock (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let lotRepo: Repository<DryingLot>;
  let gradedStockRepo: Repository<GradedStock>;

  let ownerAToken: string;
  let ownerBToken: string;
  let staffAToken: string;
  let superAdminToken: string;
  let vendorA: Vendor;
  let vendorB: Vendor;
  let lotA: DryingLot;
  let lotB: DryingLot;

  const ADMIN_EMAIL = 'e2e-graded-admin@spicewallet.test';
  const ADMIN_PASSWORD = 'AdminPass123!';
  const OWNER_A_EMAIL = 'e2e-graded-owner-a@spicewallet.test';
  const OWNER_A_PASSWORD = 'OwnerAPass123!';
  const OWNER_B_EMAIL = 'e2e-graded-owner-b@spicewallet.test';
  const OWNER_B_PASSWORD = 'OwnerBPass123!';
  const STAFF_A_EMAIL = 'e2e-graded-staff-a@spicewallet.test';
  const STAFF_A_PASSWORD = 'StaffAPass123!';

  const asOwnerA = (req: request.Test) => req.set('Authorization', `Bearer ${ownerAToken}`);
  const asOwnerB = (req: request.Test) => req.set('Authorization', `Bearer ${ownerBToken}`);
  const asStaffA = (req: request.Test) => req.set('Authorization', `Bearer ${staffAToken}`);
  const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${superAdminToken}`);

  const login = async (email: string, password: string) =>
    (
      await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(201)
    ).body.data.access_token;

  const validStockPayload = (overrides: Record<string, unknown> = {}) => ({
    drying_lot_public_id: lotA.public_id,
    grade: Grade.GRADE_A,
    weight_kg: 40.0,
    price_per_kg: 1200.0,
    ...overrides,
  });

  const createStockAsOwnerA = (overrides: Record<string, unknown> = {}) =>
    asOwnerA(request(app.getHttpServer()).post('/api/v1/graded-stock')).send(validStockPayload(overrides));

  beforeAll(async () => {
    const { app: testApp, moduleFixture } = await createTestApp();
    app = testApp;

    userRepo = moduleFixture.get(getRepositoryToken(User));
    vendorRepo = moduleFixture.get(getRepositoryToken(Vendor));
    lotRepo = moduleFixture.get(getRepositoryToken(DryingLot));
    gradedStockRepo = moduleFixture.get(getRepositoryToken(GradedStock));

    await gradedStockRepo.query('SET FOREIGN_KEY_CHECKS = 0');
    await gradedStockRepo.query('TRUNCATE TABLE graded_stock');
    await lotRepo.query('TRUNCATE TABLE drying_lots');
    await vendorRepo.query('TRUNCATE TABLE vendors');
    await userRepo.query('TRUNCATE TABLE users');
    await gradedStockRepo.query('SET FOREIGN_KEY_CHECKS = 1');

    await userRepo.save(
      userRepo.create({
        name: 'E2E Graded Admin',
        email: ADMIN_EMAIL,
        password_hash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        role: Role.SUPER_ADMIN,
        vendor_id: null,
        is_active: true,
      }),
    );

    vendorA = await vendorRepo.save(
      vendorRepo.create({
        name: 'Graded Test Shop A',
        subdomain: 'graded-test-shop-a',
        email: 'shop-graded-a@example.com',
        phone: '+919876500001',
        address: '1, Test Street',
        city: 'Kochi',
        state: 'Kerala',
        country: 'India',
        pincode: '682001',
        business_reg_no: '29ABCDEGRDA1Z5',
        business_type: 'Sole Proprietorship',
        status: VendorStatus.ACTIVE,
      }),
    );
    vendorB = await vendorRepo.save(
      vendorRepo.create({
        name: 'Graded Test Shop B',
        subdomain: 'graded-test-shop-b',
        email: 'shop-graded-b@example.com',
        phone: '+919876500002',
        address: '2, Test Street',
        city: 'Kochi',
        state: 'Kerala',
        country: 'India',
        pincode: '682002',
        business_reg_no: '29ABCDEGRDB1Z5',
        business_type: 'Partnership',
        status: VendorStatus.ACTIVE,
      }),
    );

    lotA = await lotRepo.save(lotRepo.create({ vendor_id: vendorA.id_vendor, lot_name: 'LOT-A', initial_weight_kg: 100 }));
    lotB = await lotRepo.save(lotRepo.create({ vendor_id: vendorB.id_vendor, lot_name: 'LOT-B', initial_weight_kg: 100 }));

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
      await request(app.getHttpServer()).get('/api/v1/graded-stock').expect(401);
      await request(app.getHttpServer()).post('/api/v1/graded-stock').send(validStockPayload()).expect(401);
    });

    it('rejects a SUPER_ADMIN caller', async () => {
      await asAdmin(request(app.getHttpServer()).get('/api/v1/graded-stock')).expect(403);
    });

    it('allows both VENDOR_OWNER and WAREHOUSE_STAFF', async () => {
      await asOwnerA(request(app.getHttpServer()).get('/api/v1/graded-stock')).expect(200);
      await asStaffA(request(app.getHttpServer()).get('/api/v1/graded-stock')).expect(200);
    });
  });

  describe('POST /graded-stock — validation', () => {
    it('rejects missing required fields, reporting "should not be empty" first', async () => {
      const res = await asOwnerA(request(app.getHttpServer()).post('/api/v1/graded-stock')).send({}).expect(400);
      expect(res.body.fields.drying_lot_public_id[0]).toBe('drying_lot_public_id should not be empty');
      expect(res.body.fields.grade[0]).toBe('grade should not be empty');
      expect(res.body.fields.weight_kg[0]).toBe('weight_kg should not be empty');
      expect(res.body.fields.price_per_kg[0]).toBe('price_per_kg should not be empty');
    });

    it('rejects a malformed (non-UUID) drying_lot_public_id', async () => {
      const res = await createStockAsOwnerA({ drying_lot_public_id: 'not-a-uuid' }).expect(400);
      expect(res.body.fields.drying_lot_public_id).toBeDefined();
    });

    it('rejects an invalid grade enum value', async () => {
      const res = await createStockAsOwnerA({ grade: 'NOT_A_GRADE' }).expect(400);
      expect(res.body.fields.grade).toBeDefined();
    });

    it('rejects a non-positive weight_kg or price_per_kg', async () => {
      await createStockAsOwnerA({ weight_kg: 0 }).expect(400);
      await createStockAsOwnerA({ price_per_kg: -1 }).expect(400);
    });

    it('rejects unknown fields on the DTO', () => {
      return createStockAsOwnerA({ not_a_real_field: 'x' }).expect(400);
    });

    it("404s on a drying_lot_public_id that doesn't belong to the caller's vendor", async () => {
      await createStockAsOwnerA({ drying_lot_public_id: lotB.public_id }).expect(404);
    });

    it('404s on an unknown drying_lot_public_id', async () => {
      await createStockAsOwnerA({ drying_lot_public_id: '00000000-0000-0000-0000-000000000000' }).expect(404);
    });
  });

  describe('POST /graded-stock — happy path', () => {
    it('creates a graded stock entry scoped to the caller\'s vendor', async () => {
      const res = await createStockAsOwnerA().expect(201);

      const stock = res.body.data;
      expect(stock.id_graded_stock).toBeUndefined(); // internal numeric PK must never leak
      expect(stock.vendor_id).toBe(vendorA.id_vendor);
      expect(stock.drying_lot_id).toBe(lotA.id_drying_lot);
      expect(stock.grade).toBe(Grade.GRADE_A);
      expect(Number(stock.weight_kg)).toBe(40);
      expect(Number(stock.price_per_kg)).toBe(1200);
    });

    it('accepts every valid grade value', async () => {
      for (const grade of Object.values(Grade)) {
        await createStockAsOwnerA({ grade }).expect(201);
      }
    });
  });

  describe('GET /graded-stock — list', () => {
    it("lists only the caller's own vendor's graded stock", async () => {
      const created = await createStockAsOwnerA().expect(201);

      const ownerAList = await asOwnerA(request(app.getHttpServer()).get('/api/v1/graded-stock')).expect(200);
      expect(ownerAList.body.data.some((s: any) => s.public_id === created.body.data.public_id)).toBe(true);

      const ownerBList = await asOwnerB(request(app.getHttpServer()).get('/api/v1/graded-stock')).expect(200);
      expect(ownerBList.body.data.some((s: any) => s.public_id === created.body.data.public_id)).toBe(false);
    });
  });

  describe('GET /graded-stock/:id', () => {
    it('404s on an unknown (but well-formed) stock id', () => {
      return asOwnerA(
        request(app.getHttpServer()).get('/api/v1/graded-stock/00000000-0000-0000-0000-000000000000'),
      ).expect(404);
    });

    it("404s (not 403) a request for another vendor's graded stock id", async () => {
      const created = await createStockAsOwnerA().expect(201);
      await asOwnerB(
        request(app.getHttpServer()).get(`/api/v1/graded-stock/${created.body.data.public_id}`),
      ).expect(404);
    });
  });
});
