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

describe('Staff — /api/v1/staff (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;

  let superAdminToken: string;
  let ownerAToken: string;
  let ownerBToken: string;
  let staffAToken: string;
  let vendorA: Vendor;
  let vendorB: Vendor;
  let uniqueCounter = 0;

  const ADMIN_EMAIL = 'e2e-staff-admin@spicewallet.test';
  const ADMIN_PASSWORD = 'TestPass123!';
  const OWNER_A_EMAIL = 'e2e-staff-owner-a@spicewallet.test';
  const OWNER_A_PASSWORD = 'OwnerAPass123!';
  const OWNER_B_EMAIL = 'e2e-staff-owner-b@spicewallet.test';
  const OWNER_B_PASSWORD = 'OwnerBPass123!';
  const STAFF_A_EMAIL = 'e2e-staff-existing-a@spicewallet.test';
  const STAFF_A_PASSWORD = 'StaffAPass123!';

  const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${superAdminToken}`);
  const asOwnerA = (req: request.Test) => req.set('Authorization', `Bearer ${ownerAToken}`);
  const asOwnerB = (req: request.Test) => req.set('Authorization', `Bearer ${ownerBToken}`);
  const asStaffA = (req: request.Test) => req.set('Authorization', `Bearer ${staffAToken}`);

  const validStaffPayload = (overrides: Record<string, unknown> = {}) => {
    const n = ++uniqueCounter;
    return {
      name: 'New Staff Member',
      email: `new-staff-${n}@spicewallet.test`,
      password: 'StaffSecret@123',
      ...overrides,
    };
  };

  const login = async (email: string, password: string) =>
    (
      await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(201)
    ).body.data.access_token;

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
        name: 'Staff Test Shop A',
        subdomain: 'staff-test-shop-a',
        email: 'shop-staff-a@example.com',
        phone: '+919876500001',
        address: '1, Test Street',
        city: 'Kochi',
        state: 'Kerala',
        country: 'India',
        pincode: '682001',
        business_reg_no: '29ABCDESTAFA1Z5',
        business_type: 'Sole Proprietorship',
        status: VendorStatus.ACTIVE,
      }),
    );
    vendorB = await vendorRepo.save(
      vendorRepo.create({
        name: 'Staff Test Shop B',
        subdomain: 'staff-test-shop-b',
        email: 'shop-staff-b@example.com',
        phone: '+919876500002',
        address: '2, Test Street',
        city: 'Kochi',
        state: 'Kerala',
        country: 'India',
        pincode: '682002',
        business_reg_no: '29ABCDESTAFB1Z5',
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
        name: 'E2E Existing Staff A',
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

  describe('POST /staff', () => {
    it('rejects an unauthenticated request', () => {
      return request(app.getHttpServer()).post('/api/v1/staff').send(validStaffPayload()).expect(401);
    });

    it('rejects a SUPER_ADMIN caller', () => {
      return asAdmin(request(app.getHttpServer()).post('/api/v1/staff')).send(validStaffPayload()).expect(403);
    });

    it('rejects a WAREHOUSE_STAFF caller', () => {
      return asStaffA(request(app.getHttpServer()).post('/api/v1/staff')).send(validStaffPayload()).expect(403);
    });

    it('creates a staff member, hashes the password, and returns no data on the write itself', async () => {
      const payload = validStaffPayload();

      const res = await asOwnerA(request(app.getHttpServer()).post('/api/v1/staff')).send(payload).expect(201);
      expect(res.body).toEqual({ status: true, message: 'Staff member created successfully' });
      expect(res.body.data).toBeUndefined();

      // The new staff account must actually work — proves the password was
      // hashed correctly (this exact bug — password never hashed — is what
      // caused a 500 before this fix, since password_hash is NOT NULL).
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: payload.email, password: payload.password })
        .expect(201);
      expect(login.body.data.user.role).toBe(Role.WAREHOUSE_STAFF);

      const list = await asOwnerA(request(app.getHttpServer()).get('/api/v1/staff')).expect(200);
      const created = list.body.data.find((u: any) => u.email === payload.email);
      expect(created).toBeDefined();
      expect(created.password_hash).toBeUndefined();
      expect(created.id_user).toBeUndefined();
      // vendor_id is the vendor's public_id (a UUID reference), never the raw
      // internal numeric FK — matches the same convention as the login response.
      expect(created.vendor_id).toBe(vendorA.public_id);
    });

    it('scopes the new staff member to the caller\'s own vendor, not another one', async () => {
      const payload = validStaffPayload();
      await asOwnerA(request(app.getHttpServer()).post('/api/v1/staff')).send(payload).expect(201);

      const ownerBList = await asOwnerB(request(app.getHttpServer()).get('/api/v1/staff')).expect(200);
      expect(ownerBList.body.data.some((u: any) => u.email === payload.email)).toBe(false);
    });

    it('always creates WAREHOUSE_STAFF regardless of any role field sent — no privilege escalation via this route', async () => {
      const payload = validStaffPayload();

      // role is not part of the DTO at all — sending it must 400 (forbidNonWhitelisted),
      // not silently create a SUPER_ADMIN/VENDOR_OWNER account.
      await asOwnerA(request(app.getHttpServer()).post('/api/v1/staff'))
        .send({ ...payload, role: 'SUPER_ADMIN' })
        .expect(400);
    });

    it('rejects a duplicate email', async () => {
      const payload = validStaffPayload();
      await asOwnerA(request(app.getHttpServer()).post('/api/v1/staff')).send(payload).expect(201);

      const res = await asOwnerA(request(app.getHttpServer()).post('/api/v1/staff'))
        .send(validStaffPayload({ email: payload.email }))
        .expect(409);
      expect(res.body.message).toMatch(/email/i);
    });

    it('rejects a password shorter than 6 characters', async () => {
      const res = await asOwnerA(request(app.getHttpServer()).post('/api/v1/staff'))
        .send(validStaffPayload({ password: 'Ab1!' }))
        .expect(400);
      expect(res.body.fields.password).toBeDefined();
    });

    it('rejects a password missing a letter, a number, or a special character', async () => {
      const noLetter = await asOwnerA(request(app.getHttpServer()).post('/api/v1/staff'))
        .send(validStaffPayload({ password: '12345!123456' }))
        .expect(400);
      expect(noLetter.body.fields.password).toBeDefined();

      const noNumber = await asOwnerA(request(app.getHttpServer()).post('/api/v1/staff'))
        .send(validStaffPayload({ password: 'NoDigits!' }))
        .expect(400);
      expect(noNumber.body.fields.password).toBeDefined();

      const noSpecialChar = await asOwnerA(request(app.getHttpServer()).post('/api/v1/staff'))
        .send(validStaffPayload({ password: 'NoSpecial123' }))
        .expect(400);
      expect(noSpecialChar.body.fields.password).toBeDefined();
    });

    it('rejects an invalid email format', async () => {
      const res = await asOwnerA(request(app.getHttpServer()).post('/api/v1/staff'))
        .send(validStaffPayload({ email: 'not-an-email' }))
        .expect(400);
      expect(res.body.fields.email).toBeDefined();
    });

    it('rejects a name shorter than 2 or longer than 255 characters', async () => {
      await asOwnerA(request(app.getHttpServer()).post('/api/v1/staff'))
        .send(validStaffPayload({ name: 'X' }))
        .expect(400);
      await asOwnerA(request(app.getHttpServer()).post('/api/v1/staff'))
        .send(validStaffPayload({ name: 'A'.repeat(256) }))
        .expect(400);
    });

    it('rejects missing required fields', async () => {
      const res = await asOwnerA(request(app.getHttpServer()).post('/api/v1/staff')).send({}).expect(400);
      expect(res.body.fields.name).toBeDefined();
      expect(res.body.fields.email).toBeDefined();
      expect(res.body.fields.password).toBeDefined();

      // Regression lock: main.ts's ValidationPipe uses stopAtFirstError, so a
      // missing password must report "should not be empty" (IsNotEmpty first)
      // — not "must be a string" (IsString first). See IsStrongPassword() in
      // common/validators/password.validator.ts for the required decorator order.
      expect(res.body.fields.password[0]).toBe('password should not be empty');
      // Same rule applies to name/email — CreateUserDto declares @IsNotEmpty()
      // before @IsString()/@IsEmail() for this exact reason.
      expect(res.body.fields.name[0]).toBe('name should not be empty');
      expect(res.body.fields.email[0]).toBe('email should not be empty');
    });

    it('includes error details (name/message/stack) on a validation failure, since NODE_ENV=test here', async () => {
      const res = await asOwnerA(request(app.getHttpServer()).post('/api/v1/staff')).send({}).expect(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.name).toBe('BadRequestException');
      expect(res.body.error.message).toBe('Validation failed');
      expect(res.body.error.stack).toEqual(expect.any(String));
    });

    it('includes error details on a ConflictException (duplicate email) too, not just validation errors', async () => {
      const payload = validStaffPayload();
      await asOwnerA(request(app.getHttpServer()).post('/api/v1/staff')).send(payload).expect(201);

      const res = await asOwnerA(request(app.getHttpServer()).post('/api/v1/staff'))
        .send(validStaffPayload({ email: payload.email }))
        .expect(409);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.name).toBe('ConflictException');
      expect(res.body.error.message).toMatch(/email/i);
    });
  });

  describe('GET /staff', () => {
    it('rejects an unauthenticated request', () => {
      return request(app.getHttpServer()).get('/api/v1/staff').expect(401);
    });

    it('rejects a SUPER_ADMIN caller', () => {
      return asAdmin(request(app.getHttpServer()).get('/api/v1/staff')).expect(403);
    });

    it('rejects a WAREHOUSE_STAFF caller', () => {
      return asStaffA(request(app.getHttpServer()).get('/api/v1/staff')).expect(403);
    });

    it("lists only the caller's own vendor's staff, with vendor_id as the vendor's public_id", async () => {
      const ownerAList = await asOwnerA(request(app.getHttpServer()).get('/api/v1/staff')).expect(200);
      expect(ownerAList.body.data.some((u: any) => u.email === STAFF_A_EMAIL)).toBe(true);
      expect(ownerAList.body.data.every((u: any) => u.vendor_id === vendorA.public_id)).toBe(true);

      const ownerBList = await asOwnerB(request(app.getHttpServer()).get('/api/v1/staff')).expect(200);
      expect(ownerBList.body.data.some((u: any) => u.email === STAFF_A_EMAIL)).toBe(false);
      expect(ownerBList.body.data.every((u: any) => u.vendor_id === vendorB.public_id)).toBe(true);
    });
  });
});
