import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/test-app';
import { User } from '../src/modules/users/entities/user.entity';
import { Role } from '../src/common/enums/role.enum';
import { OnboardingSource, Vendor, VendorStatus } from '../src/modules/vendors/entities/vendor.entity';
import { SubscriptionStatus, VendorSubscription } from '../src/modules/vendors/entities/vendor-subscription.entity';
import { BillingCycle, PlanType, SubscriptionPlan } from '../src/modules/subscription-plans/entities/subscription-plan.entity';

describe('Vendors — /api/v1/vendors (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let subscriptionRepo: Repository<VendorSubscription>;
  let planRepo: Repository<SubscriptionPlan>;

  let superAdminToken: string;
  let vendorOwnerToken: string;
  let starterPlanPublicId: string;
  let proPlanPublicId: string;
  let baselineDefaultTrialPlan: SubscriptionPlan;
  let uniqueCounter = 0;

  const ADMIN_EMAIL = 'e2e-admin@spicewallet.test';
  const ADMIN_PASSWORD = 'TestPass123!';
  const OWNER_EMAIL = 'e2e-owner@spicewallet.test';
  const OWNER_PASSWORD = 'OwnerPass123!';

  const validVendorPayload = (overrides: Record<string, unknown> = {}): Record<string, any> => {
    const n = ++uniqueCounter;
    return {
      name: 'Green Cardamom Shop',
      subdomain: `green-cardamom-${n}`,
      email: `shop-${n}@greencardamom.com`,
      phone: `+9198765${String(43000 + n).padStart(5, '0')}`,
      address: '42, Market Street, Idukki',
      city: 'Idukki',
      state: 'Kerala',
      country: 'India',
      pincode: '685602',
      business_reg_no: `29ABCDE${String(n).padStart(4, '0')}Z5`,
      business_type: 'Sole Proprietorship',
      owner_name: 'Ravi Kumar',
      owner_email: `owner-${n}@greencardamom.com`,
      owner_password: 'OwnerSecret123!',
      ...overrides,
    };
  };

  // Builds a full UpdateVendorDto-shaped payload from an existing vendor
  // response — PATCH /vendors/:id requires the whole DTO, not a partial.
  // UpdateVendorDto deliberately has no email/phone/owner_*/onboarding_source
  // fields — those are create-only and can no longer be changed via update.
  const toUpdatePayload = (vendor: any, overrides: Record<string, unknown> = {}) => ({
    name: vendor.name,
    subdomain: vendor.subdomain,
    address: vendor.address,
    city: vendor.city,
    state: vendor.state,
    country: vendor.country,
    pincode: vendor.pincode,
    business_reg_no: vendor.business_reg_no,
    business_type: vendor.business_type,
    ...overrides,
  });

  // Same UpdateVendorDto shape but standalone — for tests with no existing
  // vendor to derive a payload from (e.g. hitting an unknown id).
  const validUpdatePayload = (overrides: Record<string, unknown> = {}): Record<string, any> => {
    const n = ++uniqueCounter;
    return {
      name: 'Updated Shop Name',
      subdomain: `updated-shop-${n}`,
      address: '99, Updated Street',
      city: 'Kochi',
      state: 'Kerala',
      country: 'India',
      pincode: '682001',
      business_reg_no: `29UPDATED${String(n).padStart(4, '0')}`,
      business_type: 'Sole Proprietorship',
      ...overrides,
    };
  };

  const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${superAdminToken}`);
  const asOwner = (req: request.Test) => req.set('Authorization', `Bearer ${vendorOwnerToken}`);

  const createVendor = (overrides: Record<string, unknown> = {}) =>
    asAdmin(request(app.getHttpServer()).post('/api/v1/vendors')).send(validVendorPayload(overrides));

  // POST /vendors no longer returns the created vendor (just a success
  // message — see the dedicated response-shape test below), so any test
  // that needs the created vendor's data has to look it up afterward. This
  // resolves to a GET /vendors/:id Response, so `.body.data` still works
  // exactly like it used to off the (now-gone) create response.
  const onboardVendor = async (overrides: Record<string, unknown> = {}) => {
    const payload = validVendorPayload(overrides);
    await asAdmin(request(app.getHttpServer()).post('/api/v1/vendors')).send(payload).expect(201);
    const row = await vendorRepo.findOneBy({ subdomain: payload.subdomain });
    return asAdmin(request(app.getHttpServer()).get(`/api/v1/vendors/${row!.public_id}`)).expect(200);
  };

  // PATCH /vendors/:id/activate no longer returns the updated vendor either
  // (same no-data-on-write pattern as create) — same fix: activate, then
  // fetch, and hand back the fetch's Response so `.body.data` still works.
  const activateVendor = async (publicId: string, planPublicId: string) => {
    await asAdmin(request(app.getHttpServer()).patch(`/api/v1/vendors/${publicId}/activate`))
      .send({ plan_public_id: planPublicId })
      .expect(200);
    return asAdmin(request(app.getHttpServer()).get(`/api/v1/vendors/${publicId}`)).expect(200);
  };

  beforeAll(async () => {
    const { app: testApp, moduleFixture } = await createTestApp();
    app = testApp;

    userRepo = moduleFixture.get(getRepositoryToken(User));
    vendorRepo = moduleFixture.get(getRepositoryToken(Vendor));
    subscriptionRepo = moduleFixture.get(getRepositoryToken(VendorSubscription));
    planRepo = moduleFixture.get(getRepositoryToken(SubscriptionPlan));

    // Reset to a clean slate — this schema is dedicated to e2e runs (see .env.test).
    await subscriptionRepo.query('SET FOREIGN_KEY_CHECKS = 0');
    await subscriptionRepo.query('TRUNCATE TABLE vendor_subscriptions');
    await vendorRepo.query('TRUNCATE TABLE vendors');
    await userRepo.query('TRUNCATE TABLE users');
    await planRepo.query('TRUNCATE TABLE subscription_plans');
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

    const starterPlan = await planRepo.save(
      planRepo.create({
        name: 'Starter Monthly',
        plan_type: PlanType.STARTER,
        billing_cycle: BillingCycle.MONTHLY,
        monthly_fee: 299,
        is_active: true,
      }),
    );
    starterPlanPublicId = starterPlan.public_id;

    const proPlan = await planRepo.save(
      planRepo.create({
        name: 'Pro Monthly',
        plan_type: PlanType.PRO,
        billing_cycle: BillingCycle.MONTHLY,
        monthly_fee: 799,
        is_active: true,
      }),
    );
    proPlanPublicId = proPlan.public_id;

    // create() now REQUIRES an active, non-deleted default trial plan to
    // exist — onboarding 400s otherwise (see the "trial plan allocation"
    // describe block below). Every other test in this file onboards vendors
    // through the real API, so this baseline has to exist for the whole
    // suite, not just the tests that care about plan allocation specifically.
    baselineDefaultTrialPlan = await planRepo.save(
      planRepo.create({
        name: 'Baseline Default Trial Plan',
        plan_type: PlanType.STARTER,
        billing_cycle: BillingCycle.MONTHLY,
        monthly_fee: 0,
        is_active: true,
        is_default_trial: true,
      }),
    );

    const ownedVendor = await vendorRepo.save(
      vendorRepo.create({ ...validVendorPayload(), status: VendorStatus.ACTIVE }),
    );
    await userRepo.save(
      userRepo.create({
        name: 'E2E Vendor Owner',
        email: OWNER_EMAIL,
        password_hash: await bcrypt.hash(OWNER_PASSWORD, 10),
        role: Role.VENDOR_OWNER,
        vendor_id: ownedVendor.id_vendor,
        is_active: true,
      }),
    );

    superAdminToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        .expect(201)
    ).body.data.access_token;

    vendorOwnerToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD })
        .expect(201)
    ).body.data.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /vendors — onboarding', () => {
    let createdVendorPublicId: string;

    it('rejects an unauthenticated request', () => {
      return request(app.getHttpServer()).post('/api/v1/vendors').send(validVendorPayload()).expect(401);
    });

    it('rejects a non-SUPER_ADMIN caller', () => {
      return asOwner(request(app.getHttpServer()).post('/api/v1/vendors'))
        .send(validVendorPayload())
        .expect(403);
    });

    it('returns no data payload on creation, only a success message', async () => {
      const payload = validVendorPayload();
      const res = await asAdmin(request(app.getHttpServer()).post('/api/v1/vendors'))
        .send(payload)
        .expect(201);

      expect(res.body).toEqual({ status: true, message: 'Vendor onboarded successfully' });
      expect(res.body.data).toBeUndefined();
    });

    it('onboards a vendor onto an automatic 30-day trial', async () => {
      const fetched = await onboardVendor();

      const vendor = fetched.body.data;
      expect(vendor.id_vendor).toBeUndefined(); // internal numeric id must never leak
      expect(vendor.public_id).toBeDefined();
      expect(vendor.status).toBe(VendorStatus.TRIAL);
      expect(vendor.onboarding_source).toBe(OnboardingSource.SUPER_ADMIN);
      expect(vendor.country).toBe('India');
      expect(vendor.subscriptions).toHaveLength(1);

      const trialSub = vendor.subscriptions[0];
      expect(trialSub.is_trial).toBe(true);
      expect(trialSub.status).toBe(SubscriptionStatus.ACTIVE);
      // Onboarding now requires an active default trial plan to exist at
      // all (see the "trial plan allocation" describe block below), so a
      // fresh trial is always assigned to whatever that plan currently is.
      expect(trialSub.plan.public_id).toBe(baselineDefaultTrialPlan.public_id);

      const days =
        (new Date(trialSub.end_date).getTime() - new Date(trialSub.start_date).getTime()) / 86_400_000;
      expect(Math.round(days)).toBe(30);

      createdVendorPublicId = vendor.public_id;
    });

    it('shows up in the vendor list and single-vendor lookup', async () => {
      const list = await asAdmin(request(app.getHttpServer()).get('/api/v1/vendors')).expect(200);
      expect(list.body.data.some((v: any) => v.public_id === createdVendorPublicId)).toBe(true);

      const single = await asAdmin(
        request(app.getHttpServer()).get(`/api/v1/vendors/${createdVendorPublicId}`),
      ).expect(200);
      expect(single.body.data.public_id).toBe(createdVendorPublicId);
    });

    it('trims/normalizes free-text fields and uppercases business_reg_no', async () => {
      const n = ++uniqueCounter;
      const fetched = await onboardVendor({
        name: '  Padded Shop Name  ',
        city: '  Idukki  ',
        address: '  42, Market Street  ',
        email: `  Shop-Case-${n}@GreenCardamom.COM  `,
        business_reg_no: '  29abcde1234f1z5  ',
      });

      const vendor = fetched.body.data;
      expect(vendor.name).toBe('Padded Shop Name');
      expect(vendor.city).toBe('Idukki');
      expect(vendor.address).toBe('42, Market Street');
      expect(vendor.email).toBe(`shop-case-${n}@greencardamom.com`);
      expect(vendor.business_reg_no).toBe('29ABCDE1234F1Z5');
    });

    it('creates a VENDOR_OWNER account for the new vendor that can log in', async () => {
      const payload = validVendorPayload();
      await asAdmin(request(app.getHttpServer()).post('/api/v1/vendors')).send(payload).expect(201);

      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: payload.owner_email, password: payload.owner_password })
        .expect(201);

      expect(login.body.data.user.role).toBe(Role.VENDOR_OWNER);
      expect(login.body.data.user.vendor_id).not.toBeNull();

      // The owner login must be scoped to this vendor, not some other one.
      const staff = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${login.body.data.access_token}`)
        .expect(200);
      expect(staff.body.data.some((u: any) => u.email === payload.owner_email)).toBe(true);
    });
  });

  describe('POST /vendors — validation and duplicate checks', () => {
    it('rejects malformed fields (subdomain, phone, pincode)', async () => {
      const res = await createVendor({ subdomain: 'Not Valid!', phone: '123', pincode: 'abc' }).expect(400);

      expect(res.body.status).toBe(false);
      expect(res.body.fields.subdomain).toBeDefined();
      expect(res.body.fields.phone).toBeDefined();
      expect(res.body.fields.pincode).toBeDefined();
    });

    it('rejects unknown fields not on the DTO', () => {
      return createVendor({ not_a_real_field: 'x' }).expect(400);
    });

    it('rejects missing required fields', async () => {
      const res = await asAdmin(request(app.getHttpServer()).post('/api/v1/vendors')).send({}).expect(400);

      for (const field of [
        'name',
        'subdomain',
        'email',
        'phone',
        'address',
        'city',
        'state',
        'country',
        'pincode',
        'business_reg_no',
        'business_type',
        'owner_name',
        'owner_email',
        'owner_password',
      ]) {
        expect(res.body.fields[field]).toBeDefined();
      }
    });

    it('rejects a name shorter than 2, longer than 255, or non-string', async () => {
      await createVendor({ name: 'X' }).expect(400);
      await createVendor({ name: 'A'.repeat(256) }).expect(400);
      await createVendor({ name: 12345 }).expect(400);
    });

    it('rejects a subdomain shorter than 2 or longer than 100 characters', async () => {
      await createVendor({ subdomain: 'x' }).expect(400);
      await createVendor({ subdomain: 'a'.repeat(101) }).expect(400);
    });

    it('rejects an invalid email format', async () => {
      const res = await createVendor({ email: 'not-an-email' }).expect(400);
      expect(res.body.fields.email).toBeDefined();
    });

    it('rejects a phone shorter than 7 or longer than 15 digits', async () => {
      await createVendor({ phone: '123456' }).expect(400); // 6 digits
      await createVendor({ phone: '1'.repeat(16) }).expect(400); // 16 digits
    });

    it('rejects an empty or overlong address', async () => {
      await createVendor({ address: '' }).expect(400);
      await createVendor({ address: 'A'.repeat(501) }).expect(400);
    });

    it('rejects a city/state with digits/symbols or longer than 100 characters', async () => {
      await createVendor({ city: 'Idukki123' }).expect(400);
      await createVendor({ city: 'A'.repeat(101) }).expect(400);
      await createVendor({ state: 'Kerala!' }).expect(400);
    });

    it('rejects an empty, overlong, or invalid country — required, no more silent India default', async () => {
      await createVendor({ country: '' }).expect(400);
      await createVendor({ country: 'A'.repeat(101) }).expect(400);
      const res = await createVendor({ country: 'India123' }).expect(400);
      expect(res.body.fields.country).toBeDefined();
    });

    it('rejects a pincode shorter than 4 or longer than 10 digits', async () => {
      await createVendor({ pincode: '123' }).expect(400); // 3 digits
      await createVendor({ pincode: '12345678901' }).expect(400); // 11 digits
    });

    it('rejects a business_reg_no shorter than 3, longer than 50, or with invalid characters', async () => {
      await createVendor({ business_reg_no: 'AB' }).expect(400);
      await createVendor({ business_reg_no: 'A'.repeat(51) }).expect(400);
      await createVendor({ business_reg_no: 'GST@123!' }).expect(400);
    });

    it('rejects an empty or overlong business_type', async () => {
      await createVendor({ business_type: '' }).expect(400);
      await createVendor({ business_type: 'A'.repeat(256) }).expect(400);
    });

    it('rejects an owner_name shorter than 2 or longer than 255 characters', async () => {
      await createVendor({ owner_name: 'X' }).expect(400);
      await createVendor({ owner_name: 'A'.repeat(256) }).expect(400);
    });

    it('rejects an invalid owner_email format', async () => {
      const res = await createVendor({ owner_email: 'not-an-email' }).expect(400);
      expect(res.body.fields.owner_email).toBeDefined();
    });

    it('rejects an owner_password shorter than 6 characters', async () => {
      const res = await createVendor({ owner_password: 'Sh1!' }).expect(400);
      expect(res.body.fields.owner_password).toBeDefined();
    });

    it('rejects an owner_password missing a letter, a number, or a special character', async () => {
      const noNumber = await createVendor({ owner_password: 'NoDigitsHere!' }).expect(400);
      expect(noNumber.body.fields.owner_password).toBeDefined();

      const noSpecialChar = await createVendor({ owner_password: 'NoSpecialChar123' }).expect(400);
      expect(noSpecialChar.body.fields.owner_password).toBeDefined();

      const noLetter = await createVendor({ owner_password: '12345!123456' }).expect(400);
      expect(noLetter.body.fields.owner_password).toBeDefined();
    });

    it('rejects an invalid onboarding_source enum value', async () => {
      await createVendor({ onboarding_source: 'NOT_A_SOURCE' }).expect(400);
    });

    it('rejects a malformed (non-UUID) referred_by_vendor_public_id, even with REFERRAL source', async () => {
      const res = await createVendor({
        onboarding_source: OnboardingSource.REFERRAL,
        referred_by_vendor_public_id: 'not-a-uuid',
      }).expect(400);
      expect(res.body.fields.referred_by_vendor_public_id).toBeDefined();
    });

    it('accepts values at the exact boundary lengths (name/subdomain/business_reg_no)', async () => {
      await onboardVendor({ name: 'AB', subdomain: 'ab', business_reg_no: 'ABC' });
      await onboardVendor({ name: 'C'.repeat(255), business_reg_no: 'D'.repeat(50) });
    });

    it('rejects REFERRAL source missing referred_by_vendor_public_id', () => {
      return createVendor({ onboarding_source: OnboardingSource.REFERRAL }).expect(400);
    });

    it('rejects referred_by_vendor_public_id set without REFERRAL source', () => {
      return createVendor({ referred_by_vendor_public_id: '00000000-0000-0000-0000-000000000000' }).expect(
        400,
      );
    });

    it('onboards successfully via REFERRAL when a referring vendor is given', async () => {
      const referrer = await onboardVendor();

      const fetched = await onboardVendor({
        onboarding_source: OnboardingSource.REFERRAL,
        referred_by_vendor_public_id: referrer.body.data.public_id,
      });

      expect(fetched.body.data.onboarding_source).toBe(OnboardingSource.REFERRAL);
      // onboarded_by_user_id and referred_by_vendor_id are internal PKs — must
      // never appear in a response, regardless of value.
      expect(fetched.body.data.onboarded_by_user_id).toBeUndefined();
      expect(fetched.body.data.referred_by_vendor_id).toBeUndefined();

      const saved = await vendorRepo.findOneBy({ public_id: fetched.body.data.public_id });
      const referrerRow = await vendorRepo.findOneBy({ public_id: referrer.body.data.public_id });
      // onboarded_by_user_id only gets set for direct SUPER_ADMIN onboarding.
      expect(saved!.onboarded_by_user_id).toBeNull();
      expect(saved!.referred_by_vendor_id).toBe(referrerRow!.id_vendor);
    });

    it('falls back to a normal signup when referred_by_vendor_public_id does not resolve to any vendor', async () => {
      const fetched = await onboardVendor({
        onboarding_source: OnboardingSource.REFERRAL,
        referred_by_vendor_public_id: '00000000-0000-0000-0000-000000000000',
      });

      const saved = await vendorRepo.findOneBy({ public_id: fetched.body.data.public_id });
      expect(saved!.referred_by_vendor_id).toBeNull();
    });

    it('accepts onboarding_source: SELF with no referrer and no onboarded_by admin', async () => {
      const fetched = await onboardVendor({ onboarding_source: OnboardingSource.SELF });

      expect(fetched.body.data.onboarding_source).toBe(OnboardingSource.SELF);
      expect(fetched.body.data.onboarded_by).toBeNull();
      expect(fetched.body.data.referred_by).toBeNull();
    });

    it('rejects referred_by_vendor_public_id set alongside onboarding_source: SELF', () => {
      return createVendor({
        onboarding_source: OnboardingSource.SELF,
        referred_by_vendor_public_id: '00000000-0000-0000-0000-000000000000',
      }).expect(400);
    });

    it('rejects a duplicate email', async () => {
      const first = validVendorPayload();
      await asAdmin(request(app.getHttpServer()).post('/api/v1/vendors')).send(first).expect(201);

      const res = await createVendor({ email: first.email }).expect(409);
      expect(res.body.message).toMatch(/email/i);
    });

    it('rejects a duplicate subdomain', async () => {
      const first = validVendorPayload();
      await asAdmin(request(app.getHttpServer()).post('/api/v1/vendors')).send(first).expect(201);

      await createVendor({ subdomain: first.subdomain }).expect(409);
    });

    it('rejects a duplicate phone', async () => {
      const first = validVendorPayload();
      await asAdmin(request(app.getHttpServer()).post('/api/v1/vendors')).send(first).expect(201);

      const res = await createVendor({ phone: first.phone }).expect(409);
      expect(res.body.message).toMatch(/phone/i);
    });

    it('rejects a duplicate business_reg_no', async () => {
      const first = validVendorPayload();
      await asAdmin(request(app.getHttpServer()).post('/api/v1/vendors')).send(first).expect(201);

      const res = await createVendor({ business_reg_no: first.business_reg_no }).expect(409);
      expect(res.body.message).toMatch(/business_reg_no/i);
    });

    it('rejects a duplicate owner_email already used by an existing user', async () => {
      const first = validVendorPayload();
      await asAdmin(request(app.getHttpServer()).post('/api/v1/vendors')).send(first).expect(201);

      const res = await createVendor({ owner_email: first.owner_email }).expect(409);
      expect(res.body.message).toMatch(/owner_email/i);
    });
  });

  // GET /vendors (list-all) has its own dedicated suite: vendors-list.e2e-spec.ts
  // — findAll() returns a curated summary shape, not raw entities.

  describe('GET /vendors/:id', () => {
    it('rejects an unauthenticated request', async () => {
      const vendor = await onboardVendor();
      await request(app.getHttpServer()).get(`/api/v1/vendors/${vendor.body.data.public_id}`).expect(401);
    });

    it('rejects a non-SUPER_ADMIN caller', async () => {
      const vendor = await onboardVendor();
      await asOwner(
        request(app.getHttpServer()).get(`/api/v1/vendors/${vendor.body.data.public_id}`),
      ).expect(403);
    });

    it('404s on an unknown (but well-formed) vendor id', () => {
      return asAdmin(
        request(app.getHttpServer()).get('/api/v1/vendors/00000000-0000-0000-0000-000000000000'),
      ).expect(404);
    });

    it('includes onboarded_by as {name} for a directly onboarded vendor, referred_by null', async () => {
      const vendor = await onboardVendor();
      expect(vendor.body.data.onboarded_by).toEqual({ name: 'E2E Super Admin' });
      expect(vendor.body.data.referred_by).toBeNull();
    });

    it('includes referred_by as {name} for a REFERRAL-onboarded vendor, onboarded_by null', async () => {
      const referrer = await onboardVendor();
      const referred = await onboardVendor({
        onboarding_source: OnboardingSource.REFERRAL,
        referred_by_vendor_public_id: referrer.body.data.public_id,
      });

      expect(referred.body.data.onboarded_by).toBeNull();
      expect(referred.body.data.referred_by).toEqual({ name: referrer.body.data.name });
      // Only the name should be exposed — no public_id/email/other referrer fields.
      expect(Object.keys(referred.body.data.referred_by)).toEqual(['name']);
    });

    it('sorts subscriptions by activation date (start_date) descending — newest first', async () => {
      const vendor = await onboardVendor();
      const row = await vendorRepo.findOneBy({ public_id: vendor.body.data.public_id });

      // start_date is DATE-precision, so subscriptions created moments apart
      // within this test would otherwise tie — use explicit, unambiguous dates.
      await subscriptionRepo.save(
        subscriptionRepo.create({
          vendor_id: row!.id_vendor,
          plan_id: null,
          is_trial: false,
          status: SubscriptionStatus.EXPIRED,
          start_date: new Date('2020-01-01'),
          end_date: new Date('2020-02-01'),
        }),
      );
      await subscriptionRepo.save(
        subscriptionRepo.create({
          vendor_id: row!.id_vendor,
          plan_id: null,
          is_trial: false,
          status: SubscriptionStatus.EXPIRED,
          start_date: new Date('2020-06-01'),
          end_date: new Date('2020-07-01'),
        }),
      );

      const fetched = await asAdmin(
        request(app.getHttpServer()).get(`/api/v1/vendors/${vendor.body.data.public_id}`),
      ).expect(200);

      const dates = fetched.body.data.subscriptions.map((s: any) => new Date(s.start_date).getTime());
      expect(dates.length).toBeGreaterThanOrEqual(3); // trial + the two synthetic ones above

      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
      }
      // Confirm it's a real descending sort, not an accidental all-tied result.
      expect(dates[0]).toBeGreaterThan(dates[dates.length - 1]);
    });
  });

  describe('PATCH /vendors/:id', () => {
    it('rejects an unauthenticated request', async () => {
      const vendor = await onboardVendor();
      await request(app.getHttpServer())
        .patch(`/api/v1/vendors/${vendor.body.data.public_id}`)
        .send(toUpdatePayload(vendor.body.data))
        .expect(401);
    });

    it('rejects a non-SUPER_ADMIN caller', async () => {
      const vendor = await onboardVendor();
      await asOwner(request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}`))
        .send(toUpdatePayload(vendor.body.data))
        .expect(403);
    });

    it('404s on an unknown (but well-formed) vendor id', () => {
      return asAdmin(request(app.getHttpServer()).patch('/api/v1/vendors/00000000-0000-0000-0000-000000000000'))
        .send(validUpdatePayload())
        .expect(404);
    });

    it('updates a vendor and persists the change', async () => {
      const vendor = await onboardVendor();

      const res = await asAdmin(request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}`))
        .send(toUpdatePayload(vendor.body.data, { city: 'Changed City' }))
        .expect(200);

      expect(res.body.data.city).toBe('Changed City');

      const single = await asAdmin(
        request(app.getHttpServer()).get(`/api/v1/vendors/${vendor.body.data.public_id}`),
      ).expect(200);
      expect(single.body.data.city).toBe('Changed City');
    });

    it('rejects a request with country omitted — required, no more silent India default', async () => {
      const vendor = await onboardVendor();
      const { country: _omit, ...withoutCountry } = toUpdatePayload(vendor.body.data);

      const res = await asAdmin(request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}`))
        .send(withoutCountry)
        .expect(400);
      expect(res.body.fields.country).toBeDefined();
    });

    it('rejects updating to a subdomain already used by another vendor', async () => {
      const other = await onboardVendor();
      const target = await onboardVendor();

      await asAdmin(request(app.getHttpServer()).patch(`/api/v1/vendors/${target.body.data.public_id}`))
        .send(toUpdatePayload(target.body.data, { subdomain: other.body.data.subdomain }))
        .expect(409);
    });

    it('rejects updating to a business_reg_no already used by another vendor', async () => {
      const other = await onboardVendor();
      const target = await onboardVendor();

      const res = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/vendors/${target.body.data.public_id}`),
      )
        .send(toUpdatePayload(target.body.data, { business_reg_no: other.body.data.business_reg_no }))
        .expect(409);
      expect(res.body.message).toMatch(/business_reg_no/i);
    });

    it('allows re-saving a vendor with its own unchanged subdomain/business_reg_no (not a false-positive duplicate)', async () => {
      const vendor = await onboardVendor();

      await asAdmin(request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}`))
        .send(toUpdatePayload(vendor.body.data))
        .expect(200);
    });

    it('cannot change email or phone — those fields are no longer part of the update DTO', async () => {
      const vendor = await onboardVendor();

      await asAdmin(request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}`))
        .send({ ...toUpdatePayload(vendor.body.data), email: 'changed@example.com' })
        .expect(400); // forbidNonWhitelisted rejects the unknown field outright

      const single = await asAdmin(
        request(app.getHttpServer()).get(`/api/v1/vendors/${vendor.body.data.public_id}`),
      ).expect(200);
      expect(single.body.data.email).toBe(vendor.body.data.email);
    });

    it('rejects onboarding-only fields (owner_email, onboarding_source, etc.) as unknown fields', async () => {
      const vendor = await onboardVendor();

      await asAdmin(request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}`))
        .send({ ...toUpdatePayload(vendor.body.data), onboarding_source: OnboardingSource.REFERRAL })
        .expect(400);
    });

    it('rejects missing required fields', async () => {
      const vendor = await onboardVendor();
      const res = await asAdmin(request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}`))
        .send({})
        .expect(400);

      expect(res.body.fields.name).toBeDefined();
      expect(res.body.fields.subdomain).toBeDefined();
      expect(res.body.fields.address).toBeDefined();
      expect(res.body.fields.city).toBeDefined();
      expect(res.body.fields.state).toBeDefined();
      expect(res.body.fields.country).toBeDefined();
      expect(res.body.fields.pincode).toBeDefined();
      expect(res.body.fields.business_reg_no).toBeDefined();
      expect(res.body.fields.business_type).toBeDefined();
    });

    it('rejects malformed fields (subdomain, pincode)', async () => {
      const vendor = await onboardVendor();
      const res = await asAdmin(request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}`))
        .send(toUpdatePayload(vendor.body.data, { subdomain: 'Not Valid!', pincode: 'abc' }))
        .expect(400);

      expect(res.body.fields.subdomain).toBeDefined();
      expect(res.body.fields.pincode).toBeDefined();
    });

    it('rejects a name shorter than 2, longer than 255, or non-string', async () => {
      const vendor = await onboardVendor();
      const patch = (overrides: Record<string, unknown>) =>
        asAdmin(request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}`)).send(
          toUpdatePayload(vendor.body.data, overrides),
        );

      await patch({ name: 'X' }).expect(400);
      await patch({ name: 'A'.repeat(256) }).expect(400);
      await patch({ name: 12345 }).expect(400);
    });

    it('rejects a subdomain shorter than 2 or longer than 100 characters', async () => {
      const vendor = await onboardVendor();
      const patch = (overrides: Record<string, unknown>) =>
        asAdmin(request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}`)).send(
          toUpdatePayload(vendor.body.data, overrides),
        );

      await patch({ subdomain: 'x' }).expect(400);
      await patch({ subdomain: 'a'.repeat(101) }).expect(400);
    });

    it('rejects an empty or overlong address', async () => {
      const vendor = await onboardVendor();
      const patch = (overrides: Record<string, unknown>) =>
        asAdmin(request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}`)).send(
          toUpdatePayload(vendor.body.data, overrides),
        );

      await patch({ address: '' }).expect(400);
      await patch({ address: 'A'.repeat(501) }).expect(400);
    });

    it('rejects a city/state with digits/symbols or longer than 100 characters', async () => {
      const vendor = await onboardVendor();
      const patch = (overrides: Record<string, unknown>) =>
        asAdmin(request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}`)).send(
          toUpdatePayload(vendor.body.data, overrides),
        );

      await patch({ city: 'Idukki123' }).expect(400);
      await patch({ city: 'A'.repeat(101) }).expect(400);
      await patch({ state: 'Kerala!' }).expect(400);
    });

    it('rejects an empty, overlong, or invalid country', async () => {
      const vendor = await onboardVendor();
      const patch = (overrides: Record<string, unknown>) =>
        asAdmin(request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}`)).send(
          toUpdatePayload(vendor.body.data, overrides),
        );

      await patch({ country: '' }).expect(400);
      await patch({ country: 'A'.repeat(101) }).expect(400);
      const res = await patch({ country: 'India123' }).expect(400);
      expect(res.body.fields.country).toBeDefined();
    });

    it('rejects a pincode shorter than 4 or longer than 10 digits', async () => {
      const vendor = await onboardVendor();
      const patch = (overrides: Record<string, unknown>) =>
        asAdmin(request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}`)).send(
          toUpdatePayload(vendor.body.data, overrides),
        );

      await patch({ pincode: '123' }).expect(400);
      await patch({ pincode: '12345678901' }).expect(400);
    });

    it('rejects a business_reg_no shorter than 3, longer than 50, or with invalid characters', async () => {
      const vendor = await onboardVendor();
      const patch = (overrides: Record<string, unknown>) =>
        asAdmin(request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}`)).send(
          toUpdatePayload(vendor.body.data, overrides),
        );

      await patch({ business_reg_no: 'AB' }).expect(400);
      await patch({ business_reg_no: 'A'.repeat(51) }).expect(400);
      await patch({ business_reg_no: 'GST@123!' }).expect(400);
    });

    it('rejects an empty or overlong business_type', async () => {
      const vendor = await onboardVendor();
      const patch = (overrides: Record<string, unknown>) =>
        asAdmin(request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}`)).send(
          toUpdatePayload(vendor.body.data, overrides),
        );

      await patch({ business_type: '' }).expect(400);
      await patch({ business_type: 'A'.repeat(256) }).expect(400);
    });
  });

  describe('PATCH /vendors/:id/activate', () => {
    it('rejects an unauthenticated request', async () => {
      const vendor = await onboardVendor();
      await request(app.getHttpServer())
        .patch(`/api/v1/vendors/${vendor.body.data.public_id}/activate`)
        .send({ plan_public_id: starterPlanPublicId })
        .expect(401);
    });

    it('rejects a non-SUPER_ADMIN caller', async () => {
      const vendor = await onboardVendor();
      await asOwner(
        request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}/activate`),
      )
        .send({ plan_public_id: starterPlanPublicId })
        .expect(403);
    });

    it('404s on an unknown vendor id', () => {
      return asAdmin(
        request(app.getHttpServer()).patch('/api/v1/vendors/00000000-0000-0000-0000-000000000000/activate'),
      )
        .send({ plan_public_id: starterPlanPublicId })
        .expect(404);
    });

    it('rejects a malformed (non-UUID) plan_public_id', async () => {
      const vendor = await onboardVendor();
      const res = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}/activate`),
      )
        .send({ plan_public_id: 'not-a-uuid' })
        .expect(400);
      expect(res.body.fields.plan_public_id).toBeDefined();
    });

    it('rejects a missing plan_public_id', async () => {
      const vendor = await onboardVendor();
      const res = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}/activate`),
      )
        .send({})
        .expect(400);
      expect(res.body.fields.plan_public_id).toBeDefined();
    });

    it('rejects an unknown field via forbidNonWhitelisted', async () => {
      const vendor = await onboardVendor();
      await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}/activate`),
      )
        .send({ plan_public_id: starterPlanPublicId, extra_field: 'nope' })
        .expect(400);
    });

    it('rejects activation onto an unknown plan', async () => {
      const vendor = await onboardVendor();

      await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}/activate`),
      )
        .send({ plan_public_id: '00000000-0000-0000-0000-000000000000' })
        .expect(404);
    });

    it('rejects activation onto a deactivated (is_active: false) plan', async () => {
      const inactivePlan = await planRepo.save(
        planRepo.create({
          name: 'Retired Plan',
          plan_type: PlanType.STARTER,
          billing_cycle: BillingCycle.MONTHLY,
          monthly_fee: 199,
          is_active: false,
        }),
      );
      const vendor = await onboardVendor();

      const res = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}/activate`),
      )
        .send({ plan_public_id: inactivePlan.public_id })
        .expect(400);
      expect(res.body.message).toMatch(/deactivated/i);

      // Vendor must remain untouched — no partial activation.
      const single = await asAdmin(
        request(app.getHttpServer()).get(`/api/v1/vendors/${vendor.body.data.public_id}`),
      ).expect(200);
      expect(single.body.data.status).toBe(VendorStatus.TRIAL);
    });

    it('404s (not 400) activating onto a soft-deleted plan — SubscriptionPlansService.findRaw() excludes deleted plans entirely', async () => {
      const deletedPlan = await planRepo.save(
        planRepo.create({
          name: 'Deleted Plan',
          plan_type: PlanType.STARTER,
          billing_cycle: BillingCycle.MONTHLY,
          monthly_fee: 199,
          is_active: true,
          is_deleted: true,
        }),
      );
      const vendor = await onboardVendor();

      const res = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}/activate`),
      )
        .send({ plan_public_id: deletedPlan.public_id })
        .expect(404);
      expect(res.body.message).toMatch(/not found/i);

      const single = await asAdmin(
        request(app.getHttpServer()).get(`/api/v1/vendors/${vendor.body.data.public_id}`),
      ).expect(200);
      expect(single.body.data.status).toBe(VendorStatus.TRIAL);
    });

    it('returns no data payload on activation, only a success message', async () => {
      const vendor = await onboardVendor();
      const res = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}/activate`),
      )
        .send({ plan_public_id: starterPlanPublicId })
        .expect(200);

      expect(res.body).toEqual({ status: true, message: 'Vendor activated successfully' });
      expect(res.body.data).toBeUndefined();
    });

    it('activates a TRIAL vendor onto a paid plan', async () => {
      const vendor = await onboardVendor();
      const fetched = await activateVendor(vendor.body.data.public_id, starterPlanPublicId);

      const updated = fetched.body.data;
      expect(updated.status).toBe(VendorStatus.ACTIVE);

      // The new paid subscription and the expired trial both have today as
      // their start_date (DATE-precision — same-day activation is the norm),
      // so this also proves the created_at tiebreaker actually works: the
      // active one must be first, not just present somewhere in the array.
      const active = updated.subscriptions[0];
      expect(active.status).toBe(SubscriptionStatus.ACTIVE);
      expect(active.is_trial).toBe(false);
      expect(active.plan.public_id).toBe(starterPlanPublicId);

      // starterPlanPublicId is a MONTHLY plan — expect a real expiry ~1 month out,
      // not the permanent (null end_date) subscription this used to create.
      expect(active.end_date).not.toBeNull();
      const monthsOut =
        (new Date(active.end_date).getTime() - new Date(active.start_date).getTime()) / (30 * 86_400_000);
      expect(monthsOut).toBeGreaterThan(0.9);
      expect(monthsOut).toBeLessThan(1.1);

      const expiredTrial = updated.subscriptions.find((s: any) => s.is_trial);
      expect(expiredTrial.status).toBe(SubscriptionStatus.EXPIRED);
    });

    it('gives an ANNUAL plan a ~1-year expiry instead of a monthly one', async () => {
      const annualPlan = await planRepo.save(
        planRepo.create({
          name: 'Starter Annual',
          plan_type: PlanType.STARTER,
          billing_cycle: BillingCycle.ANNUAL,
          monthly_fee: 249,
          is_active: true,
        }),
      );

      const vendor = await onboardVendor();
      const fetched = await activateVendor(vendor.body.data.public_id, annualPlan.public_id);

      const active = fetched.body.data.subscriptions.find((s: any) => s.status === SubscriptionStatus.ACTIVE);
      expect(active.end_date).not.toBeNull();
      const daysOut =
        (new Date(active.end_date).getTime() - new Date(active.start_date).getTime()) / 86_400_000;
      expect(daysOut).toBeGreaterThan(360);
      expect(daysOut).toBeLessThan(370);
    });

    it('re-activates an already-ACTIVE vendor onto a different plan', async () => {
      const vendor = await onboardVendor();
      await activateVendor(vendor.body.data.public_id, starterPlanPublicId);
      const fetched = await activateVendor(vendor.body.data.public_id, proPlanPublicId);

      const updated = fetched.body.data;
      expect(updated.status).toBe(VendorStatus.ACTIVE);

      const activeSubs = updated.subscriptions.filter((s: any) => s.status === SubscriptionStatus.ACTIVE);
      expect(activeSubs).toHaveLength(1);
      expect(activeSubs[0].plan.public_id).toBe(proPlanPublicId);

      // Three subscriptions (trial, starter, pro) all tie on start_date today
      // — the current/pro one must still come first via the created_at tiebreaker.
      expect(updated.subscriptions[0].plan.public_id).toBe(proPlanPublicId);
      expect(updated.subscriptions[0].status).toBe(SubscriptionStatus.ACTIVE);

      const starterSub = updated.subscriptions.find((s: any) => s.plan?.public_id === starterPlanPublicId);
      expect(starterSub.status).toBe(SubscriptionStatus.EXPIRED);
    });

    it('activates a SUSPENDED vendor back onto a paid plan', async () => {
      const vendor = await vendorRepo.save(
        vendorRepo.create({ ...validVendorPayload(), status: VendorStatus.SUSPENDED }),
      );

      const fetched = await activateVendor(vendor.public_id, starterPlanPublicId);

      expect(fetched.body.data.status).toBe(VendorStatus.ACTIVE);
      const active = fetched.body.data.subscriptions.find((s: any) => s.status === SubscriptionStatus.ACTIVE);
      expect(active.plan.public_id).toBe(starterPlanPublicId);
    });
  });

  describe('trial plan allocation', () => {
    // create() now REQUIRES an active, non-deleted default trial plan to
    // exist at all — onboarding 400s otherwise (see below). The whole file
    // relies on baselineDefaultTrialPlan (set up in beforeAll) for every
    // other test's onboardVendor() calls to keep working, so these tests
    // always restore it in a `finally` before moving on.

    it("assigns the currently-configured default trial plan to a new vendor's trial", async () => {
      const vendor = await onboardVendor();
      const trialSub = vendor.body.data.subscriptions.find((s: any) => s.is_trial);

      expect(trialSub.is_trial).toBe(true);
      expect(trialSub.status).toBe(SubscriptionStatus.ACTIVE);
      expect(trialSub.plan.public_id).toBe(baselineDefaultTrialPlan.public_id);
    });

    it('switches new vendors over to a newly-promoted default trial plan', async () => {
      const newDefault = await planRepo.save(
        planRepo.create({
          name: 'Newly Promoted Default Trial Plan',
          plan_type: PlanType.STARTER,
          billing_cycle: BillingCycle.MONTHLY,
          monthly_fee: 0,
          is_active: true,
          is_default_trial: false,
        }),
      );

      try {
        await planRepo.update(baselineDefaultTrialPlan.id_subscription_plan, { is_default_trial: false });
        await planRepo.update(newDefault.id_subscription_plan, { is_default_trial: true });

        const vendor = await onboardVendor();
        const trialSub = vendor.body.data.subscriptions.find((s: any) => s.is_trial);
        expect(trialSub.plan.public_id).toBe(newDefault.public_id);
      } finally {
        await planRepo.update(newDefault.id_subscription_plan, { is_default_trial: false });
        await planRepo.update(baselineDefaultTrialPlan.id_subscription_plan, { is_default_trial: true });
      }
    });

    it('does not retroactively change an already-onboarded vendor when the default trial plan later changes', async () => {
      const before = await onboardVendor(); // onboarded while baseline is still the default

      const newDefault = await planRepo.save(
        planRepo.create({
          name: 'Late-Configured Default Trial Plan',
          plan_type: PlanType.STARTER,
          billing_cycle: BillingCycle.MONTHLY,
          monthly_fee: 0,
          is_active: true,
          is_default_trial: false,
        }),
      );

      try {
        await planRepo.update(baselineDefaultTrialPlan.id_subscription_plan, { is_default_trial: false });
        await planRepo.update(newDefault.id_subscription_plan, { is_default_trial: true });

        const single = await asAdmin(
          request(app.getHttpServer()).get(`/api/v1/vendors/${before.body.data.public_id}`),
        ).expect(200);
        const trialSub = single.body.data.subscriptions.find((s: any) => s.is_trial);
        expect(trialSub.plan.public_id).toBe(baselineDefaultTrialPlan.public_id);
      } finally {
        await planRepo.update(newDefault.id_subscription_plan, { is_default_trial: false });
        await planRepo.update(baselineDefaultTrialPlan.id_subscription_plan, { is_default_trial: true });
      }
    });

    it('rejects onboarding outright when no active, non-deleted default trial plan is configured', async () => {
      try {
        await planRepo.update(baselineDefaultTrialPlan.id_subscription_plan, { is_default_trial: false });

        const res = await createVendor().expect(400);
        expect(res.body.message).toMatch(/default trial plan/i);
      } finally {
        await planRepo.update(baselineDefaultTrialPlan.id_subscription_plan, { is_default_trial: true });
      }
    });

    it('rejects onboarding when the only default-flagged plan is deactivated (is_active: false)', async () => {
      const inactiveDefault = await planRepo.save(
        planRepo.create({
          name: 'Inactive Default Trial Plan',
          plan_type: PlanType.STARTER,
          billing_cycle: BillingCycle.MONTHLY,
          monthly_fee: 0,
          is_active: false,
          is_default_trial: true,
        }),
      );

      try {
        await planRepo.update(baselineDefaultTrialPlan.id_subscription_plan, { is_default_trial: false });

        await createVendor().expect(400);
      } finally {
        await planRepo.update(inactiveDefault.id_subscription_plan, { is_default_trial: false });
        await planRepo.update(baselineDefaultTrialPlan.id_subscription_plan, { is_default_trial: true });
      }
    });

    it('rejects onboarding when the only default-flagged plan is soft-deleted', async () => {
      const deletedDefault = await planRepo.save(
        planRepo.create({
          name: 'Deleted Default Trial Plan',
          plan_type: PlanType.STARTER,
          billing_cycle: BillingCycle.MONTHLY,
          monthly_fee: 0,
          is_active: true,
          is_default_trial: true,
          is_deleted: true,
        }),
      );

      try {
        await planRepo.update(baselineDefaultTrialPlan.id_subscription_plan, { is_default_trial: false });

        await createVendor().expect(400);
      } finally {
        await planRepo.update(deletedDefault.id_subscription_plan, { is_default_trial: false });
        await planRepo.update(baselineDefaultTrialPlan.id_subscription_plan, { is_default_trial: true });
      }
    });

    it('documents current behavior: a rejected onboarding (no default plan) still leaves a vendor row behind, with no subscription and no owner account', async () => {
      // create() saves the vendor row, THEN checks for a default trial plan
      // and throws if none exists — the failure isn't atomic. The owner
      // user and subscription writes (which come after the check) never
      // happen, but the vendor row itself is already committed.
      const payload = validVendorPayload();

      try {
        await planRepo.update(baselineDefaultTrialPlan.id_subscription_plan, { is_default_trial: false });

        await createVendor(payload).expect(400);

        const vendorRow = await vendorRepo.findOneBy({ subdomain: payload.subdomain });
        expect(vendorRow).not.toBeNull();

        const subscriptions = await subscriptionRepo.find({ where: { vendor_id: vendorRow!.id_vendor } });
        expect(subscriptions).toHaveLength(0);

        const ownerRow = await userRepo.findOneBy({ email: payload.owner_email });
        expect(ownerRow).toBeNull();

        // It's also visible via the list endpoint despite onboarding "failing".
        const list = await asAdmin(request(app.getHttpServer()).get('/api/v1/vendors')).expect(200);
        expect(list.body.data.some((v: any) => v.public_id === vendorRow!.public_id)).toBe(true);
      } finally {
        await planRepo.update(baselineDefaultTrialPlan.id_subscription_plan, { is_default_trial: true });
      }
    });
  });
});
