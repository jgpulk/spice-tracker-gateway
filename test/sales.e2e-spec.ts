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
import { DryingLot } from '../src/modules/drying-lots/entities/drying-lot.entity';
import { GradedStock } from '../src/modules/graded-stock/entities/graded-stock.entity';
import { Grade } from '../src/common/enums/grade.enum';
import { Client } from '../src/modules/clients/entities/client.entity';
import { ClientType } from '../src/common/enums/client-type.enum';
import { SaleType } from '../src/common/enums/sale-type.enum';

describe('Sales — /api/v1/sales (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let farmerRepo: Repository<Farmer>;
  let batchRepo: Repository<StockBatch>;
  let lotRepo: Repository<DryingLot>;
  let gradedStockRepo: Repository<GradedStock>;
  let clientRepo: Repository<Client>;

  let ownerAToken: string;
  let ownerBToken: string;
  let staffAToken: string;
  let superAdminToken: string;
  let vendorA: Vendor;
  let vendorB: Vendor;
  let farmerA: Farmer;
  let lotA: DryingLot;
  let client: Client;
  let seedCounter = 0;

  const ADMIN_EMAIL = 'e2e-sales-admin@spicewallet.test';
  const ADMIN_PASSWORD = 'AdminPass123!';
  const OWNER_A_EMAIL = 'e2e-sales-owner-a@spicewallet.test';
  const OWNER_A_PASSWORD = 'OwnerAPass123!';
  const OWNER_B_EMAIL = 'e2e-sales-owner-b@spicewallet.test';
  const OWNER_B_PASSWORD = 'OwnerBPass123!';
  const STAFF_A_EMAIL = 'e2e-sales-staff-a@spicewallet.test';
  const STAFF_A_PASSWORD = 'StaffAPass123!';

  const asOwnerA = (req: request.Test) => req.set('Authorization', `Bearer ${ownerAToken}`);
  const asOwnerB = (req: request.Test) => req.set('Authorization', `Bearer ${ownerBToken}`);
  const asStaffA = (req: request.Test) => req.set('Authorization', `Bearer ${staffAToken}`);
  const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${superAdminToken}`);

  const login = async (email: string, password: string) =>
    (
      await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(201)
    ).body.data.access_token;

  const seedReceivedBatch = async (vendor: Vendor, farmer: Farmer, raw_weight_kg = 100, price_per_kg = 80) => {
    seedCounter++;
    return batchRepo.save(
      batchRepo.create({
        vendor_id: vendor.id_vendor,
        farmer_id: farmer.id_farmer,
        raw_weight_kg,
        price_per_kg,
        status: BatchStatus.RECEIVED,
      }),
    );
  };

  const seedGradedStock = async (vendor: Vendor, lot: DryingLot, weight_kg = 20, price_per_kg = 1200) => {
    return gradedStockRepo.save(
      gradedStockRepo.create({
        vendor_id: vendor.id_vendor,
        drying_lot_id: lot.id_drying_lot,
        grade: Grade.GRADE_A,
        weight_kg,
        price_per_kg,
      }),
    );
  };

  beforeAll(async () => {
    const { app: testApp, moduleFixture } = await createTestApp();
    app = testApp;

    userRepo = moduleFixture.get(getRepositoryToken(User));
    vendorRepo = moduleFixture.get(getRepositoryToken(Vendor));
    farmerRepo = moduleFixture.get(getRepositoryToken(Farmer));
    batchRepo = moduleFixture.get(getRepositoryToken(StockBatch));
    lotRepo = moduleFixture.get(getRepositoryToken(DryingLot));
    gradedStockRepo = moduleFixture.get(getRepositoryToken(GradedStock));
    clientRepo = moduleFixture.get(getRepositoryToken(Client));

    await clientRepo.query('SET FOREIGN_KEY_CHECKS = 0');
    await clientRepo.query('TRUNCATE TABLE sale_stock_items');
    await clientRepo.query('TRUNCATE TABLE sale_batches');
    await clientRepo.query('TRUNCATE TABLE sales');
    await gradedStockRepo.query('TRUNCATE TABLE graded_stock');
    await lotRepo.query('TRUNCATE TABLE drying_lots');
    await batchRepo.query('TRUNCATE TABLE stock_batches');
    await farmerRepo.query('TRUNCATE TABLE farmers');
    await clientRepo.query('TRUNCATE TABLE clients');
    await vendorRepo.query('TRUNCATE TABLE vendors');
    await userRepo.query('TRUNCATE TABLE users');
    await clientRepo.query('SET FOREIGN_KEY_CHECKS = 1');

    await userRepo.save(
      userRepo.create({
        name: 'E2E Sales Admin',
        email: ADMIN_EMAIL,
        password_hash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        role: Role.SUPER_ADMIN,
        vendor_id: null,
        is_active: true,
      }),
    );

    vendorA = await vendorRepo.save(
      vendorRepo.create({
        name: 'Sales Test Shop A',
        subdomain: 'sales-test-shop-a',
        email: 'shop-sales-a@example.com',
        phone: '+919876500001',
        address: '1, Test Street',
        city: 'Kochi',
        state: 'Kerala',
        country: 'India',
        pincode: '682001',
        business_reg_no: '29ABCDESALA1Z5',
        business_type: 'Sole Proprietorship',
        status: VendorStatus.ACTIVE,
      }),
    );
    vendorB = await vendorRepo.save(
      vendorRepo.create({
        name: 'Sales Test Shop B',
        subdomain: 'sales-test-shop-b',
        email: 'shop-sales-b@example.com',
        phone: '+919876500002',
        address: '2, Test Street',
        city: 'Kochi',
        state: 'Kerala',
        country: 'India',
        pincode: '682002',
        business_reg_no: '29ABCDESALB1Z5',
        business_type: 'Partnership',
        status: VendorStatus.ACTIVE,
      }),
    );

    farmerA = await farmerRepo.save(
      farmerRepo.create({ vendor_id: vendorA.id_vendor, name: 'Farmer A', phone: '+919876511111' }),
    );
    lotA = await lotRepo.save(lotRepo.create({ vendor_id: vendorA.id_vendor, lot_name: 'LOT-A', initial_weight_kg: 100 }));
    client = await clientRepo.save(
      clientRepo.create({ name: 'Buyer Co', phone: '+919876599999', type: ClientType.COMPANY }),
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
      await request(app.getHttpServer()).get('/api/v1/sales').expect(401);
      await request(app.getHttpServer())
        .post('/api/v1/sales/direct-raw')
        .send({ client_public_id: client.public_id, batch_public_ids: [] })
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/v1/sales/processed')
        .send({ client_public_id: client.public_id, items: [] })
        .expect(401);
    });

    it('rejects a SUPER_ADMIN and WAREHOUSE_STAFF caller — this route is VENDOR_OWNER only', async () => {
      await asAdmin(request(app.getHttpServer()).get('/api/v1/sales')).expect(403);
      await asStaffA(request(app.getHttpServer()).get('/api/v1/sales')).expect(403);
    });
  });

  describe('POST /sales/direct-raw — validation', () => {
    it('rejects missing required fields, reporting "should not be empty" first', async () => {
      const res = await asOwnerA(request(app.getHttpServer()).post('/api/v1/sales/direct-raw')).send({}).expect(400);
      expect(res.body.fields.client_public_id[0]).toBe('client_public_id should not be empty');
      expect(res.body.fields.batch_public_ids).toBeDefined();
    });

    it('rejects an empty batch_public_ids array', async () => {
      const res = await asOwnerA(request(app.getHttpServer()).post('/api/v1/sales/direct-raw'))
        .send({ client_public_id: client.public_id, batch_public_ids: [] })
        .expect(400);
      expect(res.body.fields.batch_public_ids).toBeDefined();
    });

    it('404s on an unknown client_public_id', async () => {
      const batch = await seedReceivedBatch(vendorA, farmerA);
      await asOwnerA(request(app.getHttpServer()).post('/api/v1/sales/direct-raw'))
        .send({ client_public_id: '00000000-0000-0000-0000-000000000000', batch_public_ids: [batch.public_id] })
        .expect(404);
    });

    it('rejects unknown fields on the DTO', () => {
      return asOwnerA(request(app.getHttpServer()).post('/api/v1/sales/direct-raw'))
        .send({ client_public_id: client.public_id, batch_public_ids: [], not_a_real_field: 'x' })
        .expect(400);
    });
  });

  describe('POST /sales/direct-raw — happy path', () => {
    it('sells RECEIVED batches to a client and moves them to SOLD_RAW', async () => {
      const b1 = await seedReceivedBatch(vendorA, farmerA, 100, 80);
      const b2 = await seedReceivedBatch(vendorA, farmerA, 50, 80);

      const res = await asOwnerA(request(app.getHttpServer()).post('/api/v1/sales/direct-raw'))
        .send({ client_public_id: client.public_id, batch_public_ids: [b1.public_id, b2.public_id], notes: 'Bulk sale' })
        .expect(201);

      const sale = res.body.data;
      expect(sale.id_sale).toBeUndefined(); // internal numeric PK must never leak
      expect(sale.vendor_id).toBe(vendorA.id_vendor);
      expect(sale.sale_type).toBe(SaleType.DIRECT_RAW);
      expect(Number(sale.total_weight_kg)).toBe(150);
      expect(Number(sale.total_amount)).toBe(150 * 80);
      expect(sale.notes).toBe('Bulk sale');

      const b1Refetched = await batchRepo.findOneBy({ public_id: b1.public_id });
      const b2Refetched = await batchRepo.findOneBy({ public_id: b2.public_id });
      expect(b1Refetched!.status).toBe(BatchStatus.SOLD_RAW);
      expect(b2Refetched!.status).toBe(BatchStatus.SOLD_RAW);
    });

    it("documents current behavior: a batch_public_id that doesn't match (wrong vendor or wrong status) is silently dropped from the sale, not rejected", async () => {
      const goodBatch = await seedReceivedBatch(vendorA, farmerA, 100, 80);
      const otherVendorBatch = await seedReceivedBatch(vendorB, farmerA, 999, 80);

      const res = await asOwnerA(request(app.getHttpServer()).post('/api/v1/sales/direct-raw'))
        .send({ client_public_id: client.public_id, batch_public_ids: [goodBatch.public_id, otherVendorBatch.public_id] })
        .expect(201);

      expect(Number(res.body.data.total_weight_kg)).toBe(100);

      const refetched = await batchRepo.findOneBy({ public_id: otherVendorBatch.public_id });
      expect(refetched!.status).toBe(BatchStatus.RECEIVED); // untouched
    });
  });

  describe('POST /sales/processed — validation', () => {
    it('rejects missing required fields', async () => {
      const res = await asOwnerA(request(app.getHttpServer()).post('/api/v1/sales/processed')).send({}).expect(400);
      expect(res.body.fields.client_public_id[0]).toBe('client_public_id should not be empty');
      expect(res.body.fields.items).toBeDefined();
    });

    it('rejects an empty items array', async () => {
      const res = await asOwnerA(request(app.getHttpServer()).post('/api/v1/sales/processed'))
        .send({ client_public_id: client.public_id, items: [] })
        .expect(400);
      expect(res.body.fields.items).toBeDefined();
    });

    it('rejects a malformed item (non-UUID graded_stock_public_id, non-positive weight/price)', async () => {
      const badId = await asOwnerA(request(app.getHttpServer()).post('/api/v1/sales/processed'))
        .send({
          client_public_id: client.public_id,
          items: [{ graded_stock_public_id: 'not-a-uuid', weight_kg: 10, price_per_kg: 100 }],
        })
        .expect(400);
      expect(badId.body.fields.items).toBeDefined();

      const stock = await seedGradedStock(vendorA, lotA);
      const badWeight = await asOwnerA(request(app.getHttpServer()).post('/api/v1/sales/processed'))
        .send({
          client_public_id: client.public_id,
          items: [{ graded_stock_public_id: stock.public_id, weight_kg: 0, price_per_kg: 100 }],
        })
        .expect(400);
      expect(badWeight.body.fields.items).toBeDefined();
    });

    it("404s when a graded_stock_public_id doesn't belong to the caller's vendor or doesn't exist", async () => {
      const otherVendorStockLot = await lotRepo.save(
        lotRepo.create({ vendor_id: vendorB.id_vendor, lot_name: 'LOT-B', initial_weight_kg: 100 }),
      );
      const otherVendorStock = await seedGradedStock(vendorB, otherVendorStockLot);

      await asOwnerA(request(app.getHttpServer()).post('/api/v1/sales/processed'))
        .send({
          client_public_id: client.public_id,
          items: [{ graded_stock_public_id: otherVendorStock.public_id, weight_kg: 5, price_per_kg: 100 }],
        })
        .expect(404);

      await asOwnerA(request(app.getHttpServer()).post('/api/v1/sales/processed'))
        .send({
          client_public_id: client.public_id,
          items: [{ graded_stock_public_id: '00000000-0000-0000-0000-000000000000', weight_kg: 5, price_per_kg: 100 }],
        })
        .expect(404);
    });
  });

  describe('POST /sales/processed — happy path', () => {
    it('sells graded stock items to a client and computes line/total amounts', async () => {
      const stock1 = await seedGradedStock(vendorA, lotA, 20, 1200);
      const stock2 = await seedGradedStock(vendorA, lotA, 10, 1500);

      const res = await asOwnerA(request(app.getHttpServer()).post('/api/v1/sales/processed'))
        .send({
          client_public_id: client.public_id,
          items: [
            { graded_stock_public_id: stock1.public_id, weight_kg: 20, price_per_kg: 1200 },
            { graded_stock_public_id: stock2.public_id, weight_kg: 10, price_per_kg: 1500 },
          ],
          notes: 'Export batch',
        })
        .expect(201);

      const sale = res.body.data;
      expect(sale.sale_type).toBe(SaleType.PROCESSED_GRADE);
      expect(Number(sale.total_weight_kg)).toBe(30);
      expect(Number(sale.total_amount)).toBe(20 * 1200 + 10 * 1500);
      expect(sale.notes).toBe('Export batch');
    });
  });

  describe('GET /sales — list', () => {
    it("lists only the caller's own vendor's sales", async () => {
      const batch = await seedReceivedBatch(vendorA, farmerA);
      await asOwnerA(request(app.getHttpServer()).post('/api/v1/sales/direct-raw'))
        .send({ client_public_id: client.public_id, batch_public_ids: [batch.public_id] })
        .expect(201);

      const ownerAList = await asOwnerA(request(app.getHttpServer()).get('/api/v1/sales')).expect(200);
      expect(ownerAList.body.data.length).toBeGreaterThan(0);
      expect(ownerAList.body.data.every((s: any) => s.vendor_id === vendorA.id_vendor)).toBe(true);

      const ownerBList = await asOwnerB(request(app.getHttpServer()).get('/api/v1/sales')).expect(200);
      expect(ownerBList.body.data.every((s: any) => s.vendor_id !== vendorA.id_vendor)).toBe(true);
    });
  });
});
