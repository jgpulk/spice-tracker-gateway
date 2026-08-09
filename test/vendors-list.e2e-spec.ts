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

// findAll() (GET /vendors) returns a curated per-vendor summary, not raw
// entities — different shape/behavior than GET /vendors/:id, so it gets its
// own dedicated suite rather than living in vendor-onboarding.e2e-spec.ts.
describe('Vendors — GET /api/v1/vendors (list all, e2e)', () => {
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

  const ADMIN_NAME = 'E2E List Admin';
  const ADMIN_EMAIL = 'e2e-list-admin@spicewallet.test';
  const ADMIN_PASSWORD = 'AdminPass123!';
  const OWNER_EMAIL = 'e2e-list-owner@spicewallet.test';
  const OWNER_PASSWORD = 'OwnerPass123!';

  const validVendorPayload = (overrides: Record<string, unknown> = {}): Record<string, any> => {
    const n = ++uniqueCounter;
    return {
      name: `List Test Shop ${n}`,
      subdomain: `list-test-shop-${n}`,
      email: `list-shop-${n}@example.com`,
      phone: `+9198764${String(40000 + n).padStart(5, '0')}`,
      address: '1 Test Street',
      city: 'Kochi',
      state: 'Kerala',
      pincode: '682001',
      business_reg_no: `29LISTTEST${String(n).padStart(4, '0')}`,
      business_type: 'Sole Proprietorship',
      owner_name: 'Fixture Owner',
      owner_email: `list-owner-${n}@example.com`,
      owner_password: 'FixtureOwnerPass123!',
      ...overrides,
    };
  };

  const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${superAdminToken}`);
  const asOwner = (req: request.Test) => req.set('Authorization', `Bearer ${vendorOwnerToken}`);

  const createVendor = (overrides: Record<string, unknown> = {}) =>
    asAdmin(request(app.getHttpServer()).post('/api/v1/vendors')).send(validVendorPayload(overrides));

  const activate = (publicId: string, planPublicId: string) =>
    asAdmin(request(app.getHttpServer()).patch(`/api/v1/vendors/${publicId}/activate`)).send({
      plan_public_id: planPublicId,
    });

  const getList = () => asAdmin(request(app.getHttpServer()).get('/api/v1/vendors'));

  const findInList = (list: any[], publicId: string) => list.find((v: any) => v.public_id === publicId);

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
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password_hash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        role: Role.SUPER_ADMIN,
        vendor_id: null,
        is_active: true,
      }),
    );

    const ownedVendor = await vendorRepo.save(
      vendorRepo.create({ ...validVendorPayload(), status: VendorStatus.ACTIVE }),
    );
    await userRepo.save(
      userRepo.create({
        name: 'E2E List Owner',
        email: OWNER_EMAIL,
        password_hash: await bcrypt.hash(OWNER_PASSWORD, 10),
        role: Role.VENDOR_OWNER,
        vendor_id: ownedVendor.id_vendor,
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

  describe('authorization', () => {
    it('rejects an unauthenticated request', () => {
      return request(app.getHttpServer()).get('/api/v1/vendors').expect(401);
    });

    it('rejects a non-SUPER_ADMIN caller', () => {
      return asOwner(request(app.getHttpServer()).get('/api/v1/vendors')).expect(403);
    });
  });

  describe('response shape', () => {
    it('wraps the list in the standard envelope', async () => {
      const res = await getList().expect(200);
      expect(res.body.status).toBe(true);
      expect(res.body.message).toBe('Vendors fetched successfully');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('exposes only the curated fields — no internal PKs or raw entity fields', async () => {
      await createVendor().expect(201);
      const res = await getList().expect(200);

      const item = res.body.data[0];
      expect(Object.keys(item).sort()).toEqual(
        [
          'created_at',
          'email',
          'name',
          'onboarded_by',
          'onboarding_source',
          'phone',
          'public_id',
          'referred_by',
          'status',
          'subdomain',
          'subscription',
        ].sort(),
      );

      // Fields that exist on the entity/DTO but must not appear in the list view.
      expect(item.id_vendor).toBeUndefined();
      expect(item.onboarded_by_user_id).toBeUndefined();
      expect(item.referred_by_vendor_id).toBeUndefined();
      expect(item.address).toBeUndefined();
      expect(item.city).toBeUndefined();
      expect(item.business_reg_no).toBeUndefined();
      expect(item.subscriptions).toBeUndefined(); // plural history array — not exposed here
    });
  });

  describe('onboarded_by / referred_by', () => {
    it('shows onboarded_by as {name} for a directly SUPER_ADMIN-onboarded vendor, referred_by null', async () => {
      const vendor = await createVendor().expect(201);
      const list = await getList().expect(200);

      const item = findInList(list.body.data, vendor.body.data.public_id);
      expect(item.onboarded_by).toEqual({ name: ADMIN_NAME });
      expect(item.referred_by).toBeNull();
    });

    it('shows referred_by as {name} for a REFERRAL-onboarded vendor, onboarded_by null', async () => {
      const referrer = await createVendor().expect(201);
      const referred = await createVendor({
        onboarding_source: OnboardingSource.REFERRAL,
        referred_by_vendor_public_id: referrer.body.data.public_id,
      }).expect(201);

      const list = await getList().expect(200);
      const item = findInList(list.body.data, referred.body.data.public_id);

      expect(item.onboarded_by).toBeNull();
      expect(item.referred_by).toEqual({ name: referrer.body.data.name });
      // Only the name should be exposed — no public_id/email/other fields of the referrer.
      expect(Object.keys(item.referred_by)).toEqual(['name']);
    });
  });

  describe('subscription (single active subscription, not the full history)', () => {
    it('shows a fresh TRIAL vendor with is_trial true and no plan', async () => {
      const vendor = await createVendor().expect(201);
      const list = await getList().expect(200);
      const item = findInList(list.body.data, vendor.body.data.public_id);

      expect(item.subscription).not.toBeNull();
      expect(Object.keys(item.subscription).sort()).toEqual(['expires_at', 'is_trial', 'plan', 'status'].sort());
      expect(item.subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(item.subscription.is_trial).toBe(true);
      expect(item.subscription.plan).toBeNull();
      expect(item.subscription.expires_at).not.toBeNull();
    });

    it('shows an activated vendor with is_trial false and the paid plan', async () => {
      const vendor = await createVendor().expect(201);
      await activate(vendor.body.data.public_id, starterPlanPublicId).expect(200);

      const list = await getList().expect(200);
      const item = findInList(list.body.data, vendor.body.data.public_id);

      expect(item.subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(item.subscription.is_trial).toBe(false);
      expect(item.subscription.expires_at).toBeNull();
      expect(item.subscription.plan).toEqual({ name: 'Starter Monthly', plan_type: PlanType.STARTER });
      expect(Object.keys(item.subscription.plan)).toEqual(['name', 'plan_type']);
    });

    it('shows only the current plan after re-activating onto a different one', async () => {
      const vendor = await createVendor().expect(201);
      await activate(vendor.body.data.public_id, starterPlanPublicId).expect(200);
      await activate(vendor.body.data.public_id, proPlanPublicId).expect(200);

      const list = await getList().expect(200);
      const item = findInList(list.body.data, vendor.body.data.public_id);

      expect(item.subscription.plan).toEqual({ name: 'Pro Monthly', plan_type: PlanType.PRO });
    });

    it('shows subscription: null for a vendor with no subscription rows at all', async () => {
      const vendor = await vendorRepo.save(
        vendorRepo.create({ ...validVendorPayload(), status: VendorStatus.SUSPENDED }),
      );

      const list = await getList().expect(200);
      const item = findInList(list.body.data, vendor.public_id);

      expect(item.subscription).toBeNull();
    });
  });

  describe('completeness and ordering', () => {
    it('includes vendors of every status (TRIAL, ACTIVE, SUSPENDED) without hiding any', async () => {
      const trialVendor = await createVendor().expect(201);
      const activeVendor = await createVendor().expect(201);
      await activate(activeVendor.body.data.public_id, starterPlanPublicId).expect(200);
      const suspendedVendor = await vendorRepo.save(
        vendorRepo.create({ ...validVendorPayload(), status: VendorStatus.SUSPENDED }),
      );

      const list = await getList().expect(200);
      const ids = list.body.data.map((v: any) => v.public_id);

      expect(ids).toContain(trialVendor.body.data.public_id);
      expect(ids).toContain(activeVendor.body.data.public_id);
      expect(ids).toContain(suspendedVendor.public_id);
    });

    it('orders vendors by created_at descending (newest first)', async () => {
      const older = await vendorRepo.save(
        vendorRepo.create({ ...validVendorPayload(), status: VendorStatus.ACTIVE }),
      );
      const newer = await vendorRepo.save(
        vendorRepo.create({ ...validVendorPayload(), status: VendorStatus.ACTIVE }),
      );
      // Force unambiguous timestamps — inserts within the same test can land
      // in the same second, which would make DB-level ordering among them
      // undefined rather than actually testing the ORDER BY clause.
      await vendorRepo.update(older.id_vendor, { created_at: new Date('2020-01-01T00:00:00Z') });
      await vendorRepo.update(newer.id_vendor, { created_at: new Date('2020-01-02T00:00:00Z') });

      const list = await getList().expect(200);
      const idxOlder = list.body.data.findIndex((v: any) => v.public_id === older.public_id);
      const idxNewer = list.body.data.findIndex((v: any) => v.public_id === newer.public_id);

      expect(idxOlder).toBeGreaterThanOrEqual(0);
      expect(idxNewer).toBeGreaterThanOrEqual(0);
      expect(idxNewer).toBeLessThan(idxOlder);
    });
  });
});
