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
import { Client } from '../src/modules/clients/entities/client.entity';
import { ClientType } from '../src/common/enums/client-type.enum';

// Clients are global (buyers, not vendor-scoped) — see project memory: "Clients
// = buyers who purchase from vendors (global, no vendor lock)". So unlike
// farmers/stock-batches/etc., there is no cross-tenant isolation to test here;
// any VENDOR_OWNER can see/manage any client.
describe('Clients — /api/v1/clients (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let clientRepo: Repository<Client>;

  let ownerAToken: string;
  let ownerBToken: string;
  let staffAToken: string;
  let superAdminToken: string;
  let vendorA: Vendor;
  let uniqueCounter = 0;

  const ADMIN_EMAIL = 'e2e-clients-admin@spicewallet.test';
  const ADMIN_PASSWORD = 'AdminPass123!';
  const OWNER_A_EMAIL = 'e2e-clients-owner-a@spicewallet.test';
  const OWNER_A_PASSWORD = 'OwnerAPass123!';
  const OWNER_B_EMAIL = 'e2e-clients-owner-b@spicewallet.test';
  const OWNER_B_PASSWORD = 'OwnerBPass123!';
  const STAFF_A_EMAIL = 'e2e-clients-staff-a@spicewallet.test';
  const STAFF_A_PASSWORD = 'StaffAPass123!';

  const asOwnerA = (req: request.Test) => req.set('Authorization', `Bearer ${ownerAToken}`);
  const asOwnerB = (req: request.Test) => req.set('Authorization', `Bearer ${ownerBToken}`);
  const asStaffA = (req: request.Test) => req.set('Authorization', `Bearer ${staffAToken}`);
  const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${superAdminToken}`);

  const validClientPayload = (overrides: Record<string, unknown> = {}) => {
    const n = ++uniqueCounter;
    return {
      name: 'Spice Traders Ltd',
      phone: `+9198765${String(50000 + n).padStart(5, '0')}`,
      type: ClientType.INDIVIDUAL,
      ...overrides,
    };
  };

  const login = async (email: string, password: string) =>
    (
      await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(201)
    ).body.data.access_token;

  const createClientAsOwnerA = (overrides: Record<string, unknown> = {}) =>
    asOwnerA(request(app.getHttpServer()).post('/api/v1/clients')).send(validClientPayload(overrides));

  beforeAll(async () => {
    const { app: testApp, moduleFixture } = await createTestApp();
    app = testApp;

    userRepo = moduleFixture.get(getRepositoryToken(User));
    vendorRepo = moduleFixture.get(getRepositoryToken(Vendor));
    clientRepo = moduleFixture.get(getRepositoryToken(Client));

    await clientRepo.query('SET FOREIGN_KEY_CHECKS = 0');
    await clientRepo.query('TRUNCATE TABLE clients');
    await vendorRepo.query('TRUNCATE TABLE vendors');
    await userRepo.query('TRUNCATE TABLE users');
    await clientRepo.query('SET FOREIGN_KEY_CHECKS = 1');

    await userRepo.save(
      userRepo.create({
        name: 'E2E Clients Admin',
        email: ADMIN_EMAIL,
        password_hash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        role: Role.SUPER_ADMIN,
        vendor_id: null,
        is_active: true,
      }),
    );

    vendorA = await vendorRepo.save(
      vendorRepo.create({
        name: 'Clients Test Shop A',
        subdomain: 'clients-test-shop-a',
        email: 'shop-clients-a@example.com',
        phone: '+919876500001',
        address: '1, Test Street',
        city: 'Kochi',
        state: 'Kerala',
        country: 'India',
        pincode: '682001',
        business_reg_no: '29ABCDECLIA1Z5',
        business_type: 'Sole Proprietorship',
        status: VendorStatus.ACTIVE,
      }),
    );
    const vendorB = await vendorRepo.save(
      vendorRepo.create({
        name: 'Clients Test Shop B',
        subdomain: 'clients-test-shop-b',
        email: 'shop-clients-b@example.com',
        phone: '+919876500002',
        address: '2, Test Street',
        city: 'Kochi',
        state: 'Kerala',
        country: 'India',
        pincode: '682002',
        business_reg_no: '29ABCDECLIB1Z5',
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
    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer()).get('/api/v1/clients').expect(401);
      await request(app.getHttpServer()).post('/api/v1/clients').send(validClientPayload()).expect(401);
    });

    it('rejects a SUPER_ADMIN caller — this route is VENDOR_OWNER only', async () => {
      await asAdmin(request(app.getHttpServer()).get('/api/v1/clients')).expect(403);
    });

    it('rejects a WAREHOUSE_STAFF caller — this route is VENDOR_OWNER only', async () => {
      await asStaffA(request(app.getHttpServer()).get('/api/v1/clients')).expect(403);
    });
  });

  describe('POST /clients — validation', () => {
    it('rejects missing required fields, reporting "should not be empty" first', async () => {
      const res = await asOwnerA(request(app.getHttpServer()).post('/api/v1/clients')).send({}).expect(400);
      expect(res.body.fields.name[0]).toBe('name should not be empty');
      expect(res.body.fields.phone[0]).toBe('phone should not be empty');
      expect(res.body.fields.type).toBeDefined();
    });

    it('rejects a name shorter than 2, longer than 255, or non-string (transform must not crash on a non-string)', async () => {
      await createClientAsOwnerA({ name: 'X' }).expect(400);
      await createClientAsOwnerA({ name: 'A'.repeat(256) }).expect(400);
      await createClientAsOwnerA({ name: 12345 }).expect(400);
    });

    it('rejects a malformed phone number', async () => {
      const res = await createClientAsOwnerA({ phone: '123' }).expect(400);
      expect(res.body.fields.phone).toBeDefined();
    });

    it('rejects an invalid type enum value', async () => {
      const res = await createClientAsOwnerA({ type: 'NOT_A_TYPE' }).expect(400);
      expect(res.body.fields.type).toBeDefined();
    });

    it('rejects a malformed optional email without crashing (transform must not call .trim() on a non-string)', async () => {
      const res = await createClientAsOwnerA({ email: 12345 }).expect(400);
      expect(res.body.fields.email).toBeDefined();
    });

    it('rejects an invalid optional email format', async () => {
      const res = await createClientAsOwnerA({ email: 'not-an-email' }).expect(400);
      expect(res.body.fields.email).toBeDefined();
    });

    it('rejects unknown fields on the DTO', () => {
      return createClientAsOwnerA({ not_a_real_field: 'x' }).expect(400);
    });

    it('creates successfully without any optional fields', async () => {
      const res = await createClientAsOwnerA().expect(201);
      expect(res.body.data.email).toBeNull();
      expect(res.body.data.company_name).toBeNull();
      expect(res.body.data.address).toBeNull();
    });
  });

  describe('POST /clients — happy path', () => {
    it('creates a client, trims/lowercases text fields', async () => {
      const n = ++uniqueCounter;
      const res = await createClientAsOwnerA({
        name: '  Padded Trader  ',
        email: `  Trader-${n}@Example.COM  `,
        company_name: '  Padded Co  ',
        address: '  Padded Address  ',
      }).expect(201);

      const client = res.body.data;
      expect(client.id_client).toBeUndefined(); // internal numeric PK must never leak
      expect(client.public_id).toBeDefined();
      expect(client.name).toBe('Padded Trader');
      expect(client.email).toBe(`trader-${n}@example.com`);
      expect(client.company_name).toBe('Padded Co');
      expect(client.address).toBe('Padded Address');
    });

    it('accepts type: VENDOR with a ref_vendor_id', async () => {
      const res = await createClientAsOwnerA({ type: ClientType.VENDOR, ref_vendor_id: vendorA.id_vendor }).expect(
        201,
      );
      expect(res.body.data.type).toBe(ClientType.VENDOR);
      expect(res.body.data.ref_vendor_id).toBe(vendorA.id_vendor);
    });

    it('is visible to any VENDOR_OWNER, not just the one who created it — clients are global', async () => {
      const created = await createClientAsOwnerA().expect(201);

      const ownerBView = await asOwnerB(
        request(app.getHttpServer()).get(`/api/v1/clients/${created.body.data.public_id}`),
      ).expect(200);
      expect(ownerBView.body.data.public_id).toBe(created.body.data.public_id);

      const ownerBList = await asOwnerB(request(app.getHttpServer()).get('/api/v1/clients')).expect(200);
      expect(ownerBList.body.data.some((c: any) => c.public_id === created.body.data.public_id)).toBe(true);
    });
  });

  describe('GET /clients/:id', () => {
    it('404s on an unknown (but well-formed) client id', () => {
      return asOwnerA(
        request(app.getHttpServer()).get('/api/v1/clients/00000000-0000-0000-0000-000000000000'),
      ).expect(404);
    });
  });

  describe('PATCH /clients/:id', () => {
    it('updates a client and persists the change', async () => {
      const created = await createClientAsOwnerA().expect(201);

      await asOwnerA(request(app.getHttpServer()).patch(`/api/v1/clients/${created.body.data.public_id}`))
        .send(validClientPayload({ name: 'Updated Name' }))
        .expect(200);

      const refetched = await asOwnerA(
        request(app.getHttpServer()).get(`/api/v1/clients/${created.body.data.public_id}`),
      ).expect(200);
      expect(refetched.body.data.name).toBe('Updated Name');
    });

    it('404s on an unknown client id', () => {
      return asOwnerA(request(app.getHttpServer()).patch('/api/v1/clients/00000000-0000-0000-0000-000000000000'))
        .send(validClientPayload())
        .expect(404);
    });

    it("lets a different VENDOR_OWNER update a client too — clients are global, not owner-locked", async () => {
      const created = await createClientAsOwnerA().expect(201);

      await asOwnerB(request(app.getHttpServer()).patch(`/api/v1/clients/${created.body.data.public_id}`))
        .send(validClientPayload({ name: 'Updated By B' }))
        .expect(200);

      const refetched = await asOwnerA(
        request(app.getHttpServer()).get(`/api/v1/clients/${created.body.data.public_id}`),
      ).expect(200);
      expect(refetched.body.data.name).toBe('Updated By B');
    });

    it('rejects missing required fields on update', async () => {
      const created = await createClientAsOwnerA().expect(201);
      const res = await asOwnerA(request(app.getHttpServer()).patch(`/api/v1/clients/${created.body.data.public_id}`))
        .send({})
        .expect(400);
      expect(res.body.fields.name).toBeDefined();
      expect(res.body.fields.phone).toBeDefined();
    });
  });
});
