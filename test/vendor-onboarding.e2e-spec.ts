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
      pincode: '685602',
      business_reg_no: `29ABCDE${String(n).padStart(4, '0')}Z5`,
      business_type: 'Sole Proprietorship',
      owner_name: 'Ravi Kumar',
      owner_email: `owner-${n}@greencardamom.com`,
      owner_password: 'OwnerSecret123!',
      ...overrides,
    };
  };

  // Builds a full CreateVendorDto-shaped payload from an existing vendor
  // response — PATCH /vendors/:id requires the whole DTO, not a partial.
  // owner_* fields are required by the DTO but ignored by update() (they're
  // only consumed on creation), so dummy values are enough here.
  const toUpdatePayload = (vendor: any, overrides: Record<string, unknown> = {}) => ({
    name: vendor.name,
    subdomain: vendor.subdomain,
    email: vendor.email,
    phone: vendor.phone,
    address: vendor.address,
    city: vendor.city,
    state: vendor.state,
    country: vendor.country,
    pincode: vendor.pincode,
    business_reg_no: vendor.business_reg_no,
    business_type: vendor.business_type,
    owner_name: 'Ignored Owner',
    owner_email: 'ignored-owner@example.com',
    owner_password: 'IgnoredPass123!',
    ...overrides,
  });

  const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${superAdminToken}`);
  const asOwner = (req: request.Test) => req.set('Authorization', `Bearer ${vendorOwnerToken}`);

  const createVendor = (overrides: Record<string, unknown> = {}) =>
    asAdmin(request(app.getHttpServer()).post('/api/v1/vendors')).send(validVendorPayload(overrides));

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

    it('onboards a vendor onto an automatic 30-day trial', async () => {
      const res = await createVendor().expect(201);

      const vendor = res.body.data;
      expect(res.body.status).toBe(true);
      expect(vendor.id_vendor).toBeUndefined(); // internal numeric id must never leak
      expect(vendor.public_id).toBeDefined();
      expect(vendor.status).toBe(VendorStatus.TRIAL);
      expect(vendor.onboarding_source).toBe(OnboardingSource.SUPER_ADMIN);
      expect(vendor.country).toBe('India'); // default applied
      expect(vendor.subscriptions).toHaveLength(1);

      const trialSub = vendor.subscriptions[0];
      expect(trialSub.is_trial).toBe(true);
      expect(trialSub.status).toBe(SubscriptionStatus.ACTIVE);
      expect(trialSub.plan_id).toBeNull();

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
      const res = await createVendor({
        name: '  Padded Shop Name  ',
        city: '  Idukki  ',
        address: '  42, Market Street  ',
        email: `  Shop-Case-${n}@GreenCardamom.COM  `,
        business_reg_no: '  29abcde1234f1z5  ',
      }).expect(201);

      const vendor = res.body.data;
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

    it('rejects REFERRAL source missing referred_by_vendor_public_id', () => {
      return createVendor({ onboarding_source: OnboardingSource.REFERRAL }).expect(400);
    });

    it('rejects referred_by_vendor_public_id set without REFERRAL source', () => {
      return createVendor({ referred_by_vendor_public_id: '00000000-0000-0000-0000-000000000000' }).expect(
        400,
      );
    });

    it('onboards successfully via REFERRAL when a referring vendor is given', async () => {
      const referrer = await createVendor().expect(201);

      const res = await createVendor({
        onboarding_source: OnboardingSource.REFERRAL,
        referred_by_vendor_public_id: referrer.body.data.public_id,
      }).expect(201);

      expect(res.body.data.onboarding_source).toBe(OnboardingSource.REFERRAL);
      // onboarded_by_user_id and referred_by_vendor_id are internal PKs — must
      // never appear in a response, regardless of value.
      expect(res.body.data.onboarded_by_user_id).toBeUndefined();
      expect(res.body.data.referred_by_vendor_id).toBeUndefined();

      const saved = await vendorRepo.findOneBy({ public_id: res.body.data.public_id });
      const referrerRow = await vendorRepo.findOneBy({ public_id: referrer.body.data.public_id });
      // onboarded_by_user_id only gets set for direct SUPER_ADMIN onboarding.
      expect(saved!.onboarded_by_user_id).toBeNull();
      expect(saved!.referred_by_vendor_id).toBe(referrerRow!.id_vendor);
    });

    it('falls back to a normal signup when referred_by_vendor_public_id does not resolve to any vendor', async () => {
      const res = await createVendor({
        onboarding_source: OnboardingSource.REFERRAL,
        referred_by_vendor_public_id: '00000000-0000-0000-0000-000000000000',
      }).expect(201);

      const saved = await vendorRepo.findOneBy({ public_id: res.body.data.public_id });
      expect(saved!.referred_by_vendor_id).toBeNull();
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

  describe('GET /vendors', () => {
    it('rejects an unauthenticated request', () => {
      return request(app.getHttpServer()).get('/api/v1/vendors').expect(401);
    });

    it('rejects a non-SUPER_ADMIN caller', () => {
      return asOwner(request(app.getHttpServer()).get('/api/v1/vendors')).expect(403);
    });

    it('lists vendors for a SUPER_ADMIN caller', async () => {
      const res = await asAdmin(request(app.getHttpServer()).get('/api/v1/vendors')).expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /vendors/:id', () => {
    it('rejects an unauthenticated request', async () => {
      const vendor = await createVendor().expect(201);
      await request(app.getHttpServer()).get(`/api/v1/vendors/${vendor.body.data.public_id}`).expect(401);
    });

    it('rejects a non-SUPER_ADMIN caller', async () => {
      const vendor = await createVendor().expect(201);
      await asOwner(
        request(app.getHttpServer()).get(`/api/v1/vendors/${vendor.body.data.public_id}`),
      ).expect(403);
    });

    it('404s on an unknown (but well-formed) vendor id', () => {
      return asAdmin(
        request(app.getHttpServer()).get('/api/v1/vendors/00000000-0000-0000-0000-000000000000'),
      ).expect(404);
    });
  });

  describe('PATCH /vendors/:id', () => {
    it('rejects an unauthenticated request', async () => {
      const vendor = await createVendor().expect(201);
      await request(app.getHttpServer())
        .patch(`/api/v1/vendors/${vendor.body.data.public_id}`)
        .send(toUpdatePayload(vendor.body.data))
        .expect(401);
    });

    it('rejects a non-SUPER_ADMIN caller', async () => {
      const vendor = await createVendor().expect(201);
      await asOwner(request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}`))
        .send(toUpdatePayload(vendor.body.data))
        .expect(403);
    });

    it('404s on an unknown (but well-formed) vendor id', () => {
      return asAdmin(request(app.getHttpServer()).patch('/api/v1/vendors/00000000-0000-0000-0000-000000000000'))
        .send(validVendorPayload())
        .expect(404);
    });

    it('updates a vendor and persists the change', async () => {
      const vendor = await createVendor().expect(201);

      const res = await asAdmin(request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}`))
        .send(toUpdatePayload(vendor.body.data, { city: 'Changed City' }))
        .expect(200);

      expect(res.body.data.city).toBe('Changed City');

      const single = await asAdmin(
        request(app.getHttpServer()).get(`/api/v1/vendors/${vendor.body.data.public_id}`),
      ).expect(200);
      expect(single.body.data.city).toBe('Changed City');
    });

    it('rejects updating to an email already used by another vendor', async () => {
      const other = await createVendor().expect(201);
      const target = await createVendor().expect(201);

      const res = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/vendors/${target.body.data.public_id}`),
      )
        .send(toUpdatePayload(target.body.data, { email: other.body.data.email }))
        .expect(409);
      expect(res.body.message).toMatch(/email/i);
    });

    it('rejects updating to a subdomain already used by another vendor', async () => {
      const other = await createVendor().expect(201);
      const target = await createVendor().expect(201);

      await asAdmin(request(app.getHttpServer()).patch(`/api/v1/vendors/${target.body.data.public_id}`))
        .send(toUpdatePayload(target.body.data, { subdomain: other.body.data.subdomain }))
        .expect(409);
    });

    it('allows re-saving a vendor with its own unchanged email/subdomain (not a false-positive duplicate)', async () => {
      const vendor = await createVendor().expect(201);

      await asAdmin(request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}`))
        .send(toUpdatePayload(vendor.body.data))
        .expect(200);
    });

    it('links a referrer via referred_by_vendor_public_id on update', async () => {
      const referrer = await createVendor().expect(201);
      const target = await createVendor().expect(201);

      const res = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/vendors/${target.body.data.public_id}`),
      )
        .send(
          toUpdatePayload(target.body.data, {
            onboarding_source: OnboardingSource.REFERRAL,
            referred_by_vendor_public_id: referrer.body.data.public_id,
          }),
        )
        .expect(200);

      expect(res.body.data.onboarding_source).toBe(OnboardingSource.REFERRAL);

      const saved = await vendorRepo.findOneBy({ public_id: target.body.data.public_id });
      const referrerRow = await vendorRepo.findOneBy({ public_id: referrer.body.data.public_id });
      expect(saved!.referred_by_vendor_id).toBe(referrerRow!.id_vendor);
    });

    it('rejects REFERRAL source missing referred_by_vendor_public_id on update', async () => {
      const vendor = await createVendor().expect(201);
      await asAdmin(request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}`))
        .send(toUpdatePayload(vendor.body.data, { onboarding_source: OnboardingSource.REFERRAL }))
        .expect(400);
    });
  });

  describe('PATCH /vendors/:id/activate', () => {
    it('rejects an unauthenticated request', async () => {
      const vendor = await createVendor().expect(201);
      await request(app.getHttpServer())
        .patch(`/api/v1/vendors/${vendor.body.data.public_id}/activate`)
        .send({ plan_public_id: starterPlanPublicId })
        .expect(401);
    });

    it('rejects a non-SUPER_ADMIN caller', async () => {
      const vendor = await createVendor().expect(201);
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
      const vendor = await createVendor().expect(201);
      const res = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}/activate`),
      )
        .send({ plan_public_id: 'not-a-uuid' })
        .expect(400);
      expect(res.body.fields.plan_public_id).toBeDefined();
    });

    it('rejects activation onto an unknown plan', async () => {
      const vendor = await createVendor().expect(201);

      await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}/activate`),
      )
        .send({ plan_public_id: '00000000-0000-0000-0000-000000000000' })
        .expect(404);
    });

    it('activates a TRIAL vendor onto a paid plan', async () => {
      const vendor = await createVendor().expect(201);

      const res = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}/activate`),
      )
        .send({ plan_public_id: starterPlanPublicId })
        .expect(200);

      const updated = res.body.data;
      expect(updated.status).toBe(VendorStatus.ACTIVE);

      const active = updated.subscriptions.find((s: any) => s.status === SubscriptionStatus.ACTIVE);
      expect(active.is_trial).toBe(false);
      expect(active.plan.public_id).toBe(starterPlanPublicId);
      expect(active.end_date).toBeNull();

      const expiredTrial = updated.subscriptions.find((s: any) => s.is_trial);
      expect(expiredTrial.status).toBe(SubscriptionStatus.EXPIRED);
    });

    it('re-activates an already-ACTIVE vendor onto a different plan', async () => {
      const vendor = await createVendor().expect(201);
      await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}/activate`),
      )
        .send({ plan_public_id: starterPlanPublicId })
        .expect(200);

      const res = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.body.data.public_id}/activate`),
      )
        .send({ plan_public_id: proPlanPublicId })
        .expect(200);

      const updated = res.body.data;
      expect(updated.status).toBe(VendorStatus.ACTIVE);

      const activeSubs = updated.subscriptions.filter((s: any) => s.status === SubscriptionStatus.ACTIVE);
      expect(activeSubs).toHaveLength(1);
      expect(activeSubs[0].plan.public_id).toBe(proPlanPublicId);

      const starterSub = updated.subscriptions.find((s: any) => s.plan?.public_id === starterPlanPublicId);
      expect(starterSub.status).toBe(SubscriptionStatus.EXPIRED);
    });

    it('activates a SUSPENDED vendor back onto a paid plan', async () => {
      const vendor = await vendorRepo.save(
        vendorRepo.create({ ...validVendorPayload(), status: VendorStatus.SUSPENDED }),
      );

      const res = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/vendors/${vendor.public_id}/activate`),
      )
        .send({ plan_public_id: starterPlanPublicId })
        .expect(200);

      expect(res.body.data.status).toBe(VendorStatus.ACTIVE);
      const active = res.body.data.subscriptions.find((s: any) => s.status === SubscriptionStatus.ACTIVE);
      expect(active.plan.public_id).toBe(starterPlanPublicId);
    });
  });
});
