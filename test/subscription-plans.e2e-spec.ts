import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './utils/test-app';
import { User } from '../src/modules/users/entities/user.entity';
import { Role } from '../src/common/enums/role.enum';
import { Vendor } from '../src/modules/vendors/entities/vendor.entity';
import { BillingCycle, PlanType, SubscriptionPlan } from '../src/modules/subscription-plans/entities/subscription-plan.entity';

describe('Subscription Plans — /api/v1/subscription-plans (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let planRepo: Repository<SubscriptionPlan>;

  let superAdminToken: string;
  let vendorOwnerToken: string;
  let uniqueCounter = 0;

  const ADMIN_EMAIL = 'e2e-plans-admin@spicewallet.test';
  const ADMIN_PASSWORD = 'AdminPass123!';
  const OWNER_EMAIL = 'e2e-plans-owner@spicewallet.test';
  const OWNER_PASSWORD = 'OwnerPass123!';

  const validPlanPayload = (overrides: Record<string, unknown> = {}): Record<string, any> => {
    const n = ++uniqueCounter;
    return {
      name: `Plan ${n}`,
      plan_type: PlanType.STARTER,
      billing_cycle: BillingCycle.MONTHLY,
      monthly_fee: 299,
      ...overrides,
    };
  };

  const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${superAdminToken}`);
  const asOwner = (req: request.Test) => req.set('Authorization', `Bearer ${vendorOwnerToken}`);

  const createPlan = (overrides: Record<string, unknown> = {}) =>
    asAdmin(request(app.getHttpServer()).post('/api/v1/subscription-plans')).send(validPlanPayload(overrides));

  // PATCH /subscription-plans/:id uses UpdateSubscriptionPlanDto, which
  // extends CreateSubscriptionPlanDto (core fields all required, same
  // pattern as PATCH /vendors/:id) and adds is_default_trial back —
  // that flag can only ever be set via update, never on create.
  const toUpdatePayload = (plan: any, overrides: Record<string, unknown> = {}) => ({
    name: plan.name,
    plan_type: plan.plan_type,
    billing_cycle: plan.billing_cycle,
    monthly_fee: Number(plan.monthly_fee),
    ...(plan.description ? { description: plan.description } : {}),
    is_active: plan.is_active,
    is_default_trial: plan.is_default_trial,
    ...overrides,
  });

  const promoteToDefaultTrial = (plan: any) =>
    asAdmin(request(app.getHttpServer()).patch(`/api/v1/subscription-plans/${plan.public_id}`)).send(
      toUpdatePayload(plan, { is_default_trial: true }),
    );

  beforeAll(async () => {
    const { app: testApp, moduleFixture } = await createTestApp();
    app = testApp;

    userRepo = moduleFixture.get(getRepositoryToken(User));
    vendorRepo = moduleFixture.get(getRepositoryToken(Vendor));
    planRepo = moduleFixture.get(getRepositoryToken(SubscriptionPlan));

    // Reset to a clean slate — this schema is dedicated to e2e runs (see .env.test).
    await planRepo.query('SET FOREIGN_KEY_CHECKS = 0');
    await planRepo.query('TRUNCATE TABLE subscription_plans');
    await vendorRepo.query('TRUNCATE TABLE vendors');
    await userRepo.query('TRUNCATE TABLE users');
    await planRepo.query('SET FOREIGN_KEY_CHECKS = 1');

    await userRepo.save(
      userRepo.create({
        name: 'E2E Plans Admin',
        email: ADMIN_EMAIL,
        password_hash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        role: Role.SUPER_ADMIN,
        vendor_id: null,
        is_active: true,
      }),
    );

    const ownedVendor = await vendorRepo.save(
      vendorRepo.create({
        name: 'Plans Test Shop',
        subdomain: 'plans-test-shop',
        email: 'plans-test-shop@example.com',
        phone: '+919876500002',
        address: '1 Test Street',
        city: 'Kochi',
        state: 'Kerala',
        pincode: '682001',
      }),
    );
    await userRepo.save(
      userRepo.create({
        name: 'E2E Plans Owner',
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

  describe('POST /subscription-plans', () => {
    it('rejects an unauthenticated request', () => {
      return request(app.getHttpServer())
        .post('/api/v1/subscription-plans')
        .send(validPlanPayload())
        .expect(401);
    });

    it('rejects a non-SUPER_ADMIN caller', () => {
      return asOwner(request(app.getHttpServer()).post('/api/v1/subscription-plans'))
        .send(validPlanPayload())
        .expect(403);
    });

    it('creates a plan with defaults applied', async () => {
      const res = await createPlan().expect(201);

      const plan = res.body.data;
      expect(plan.id_subscription_plan).toBeUndefined(); // internal PK must never leak
      expect(plan.public_id).toBeDefined();
      expect(plan.is_active).toBe(true); // defaults to true when omitted
      expect(plan.is_default_trial).toBe(false); // defaults to false when omitted
    });

    it('rejects missing required fields', async () => {
      const res = await asAdmin(request(app.getHttpServer()).post('/api/v1/subscription-plans'))
        .send({})
        .expect(400);
      expect(res.body.fields.name).toBeDefined();
      expect(res.body.fields.plan_type).toBeDefined();
      expect(res.body.fields.billing_cycle).toBeDefined();
      expect(res.body.fields.monthly_fee).toBeDefined();
    });

    it('rejects an invalid plan_type/billing_cycle enum value', async () => {
      const res = await createPlan({ plan_type: 'NOT_A_TYPE', billing_cycle: 'NOT_A_CYCLE' }).expect(400);
      expect(res.body.fields.plan_type).toBeDefined();
      expect(res.body.fields.billing_cycle).toBeDefined();
    });

    it('rejects a non-positive monthly_fee', async () => {
      const res = await createPlan({ monthly_fee: 0 }).expect(400);
      expect(res.body.fields.monthly_fee).toBeDefined();
    });

    it('rejects unknown fields on the DTO', () => {
      return createPlan({ not_a_real_field: 'x' }).expect(400);
    });

    it('rejects is_default_trial on create — that flag can only be set via update', () => {
      return createPlan({ is_default_trial: true }).expect(400);
    });
  });

  describe('GET /subscription-plans', () => {
    it('rejects an unauthenticated request', () => {
      return request(app.getHttpServer()).get('/api/v1/subscription-plans').expect(401);
    });

    it('rejects a non-SUPER_ADMIN caller', () => {
      return asOwner(request(app.getHttpServer()).get('/api/v1/subscription-plans')).expect(403);
    });

    it('lists plans for a SUPER_ADMIN caller', async () => {
      await createPlan().expect(201);
      const res = await asAdmin(request(app.getHttpServer()).get('/api/v1/subscription-plans')).expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('returns a curated shape per plan — no internal PK, no timestamps', async () => {
      const plan = await createPlan({ description: 'A described plan' }).expect(201);

      const res = await asAdmin(request(app.getHttpServer()).get('/api/v1/subscription-plans')).expect(200);
      const item = res.body.data.find((p: any) => p.public_id === plan.body.data.public_id);

      expect(item).toBeDefined();
      expect(Object.keys(item).sort()).toEqual(
        ['billing_cycle', 'description', 'is_active', 'is_default_trial', 'monthly_fee', 'name', 'plan_type', 'public_id'].sort(),
      );
      expect(item.id_subscription_plan).toBeUndefined();
      expect(item.created_at).toBeUndefined();
      expect(item.updated_at).toBeUndefined();
    });

    it('includes deactivated (is_active: false) plans in the list too — no filtering', async () => {
      const active = await createPlan().expect(201);
      const inactive = await planRepo.save(
        planRepo.create({
          name: 'Deactivated Plan',
          plan_type: PlanType.STARTER,
          billing_cycle: BillingCycle.MONTHLY,
          monthly_fee: 149,
          is_active: false,
        }),
      );

      const res = await asAdmin(request(app.getHttpServer()).get('/api/v1/subscription-plans')).expect(200);
      const ids = res.body.data.map((p: any) => p.public_id);

      expect(ids).toContain(active.body.data.public_id);
      expect(ids).toContain(inactive.public_id);

      const item = res.body.data.find((p: any) => p.public_id === inactive.public_id);
      expect(item.is_active).toBe(false);
    });

    it('allows fetching a deactivated plan directly by id', async () => {
      const inactive = await planRepo.save(
        planRepo.create({
          name: 'Deactivated But Fetchable',
          plan_type: PlanType.STARTER,
          billing_cycle: BillingCycle.MONTHLY,
          monthly_fee: 149,
          is_active: false,
        }),
      );

      const res = await asAdmin(
        request(app.getHttpServer()).get(`/api/v1/subscription-plans/${inactive.public_id}`),
      ).expect(200);
      expect(res.body.data.name).toBe('Deactivated But Fetchable');
      expect(res.body.data.is_active).toBe(false);
    });
  });

  describe('GET /subscription-plans/:id', () => {
    it('rejects an unauthenticated request', async () => {
      const plan = await createPlan().expect(201);
      await request(app.getHttpServer())
        .get(`/api/v1/subscription-plans/${plan.body.data.public_id}`)
        .expect(401);
    });

    it('rejects a non-SUPER_ADMIN caller', async () => {
      const plan = await createPlan().expect(201);
      await asOwner(
        request(app.getHttpServer()).get(`/api/v1/subscription-plans/${plan.body.data.public_id}`),
      ).expect(403);
    });

    it('fetches a plan by public_id', async () => {
      const plan = await createPlan({ name: 'Fetchable Plan' }).expect(201);
      const res = await asAdmin(
        request(app.getHttpServer()).get(`/api/v1/subscription-plans/${plan.body.data.public_id}`),
      ).expect(200);
      expect(res.body.data.name).toBe('Fetchable Plan');
    });

    it('404s on an unknown (but well-formed) plan id', () => {
      return asAdmin(
        request(app.getHttpServer()).get('/api/v1/subscription-plans/00000000-0000-0000-0000-000000000000'),
      ).expect(404);
    });
  });

  describe('PATCH /subscription-plans/:id', () => {
    it('rejects an unauthenticated request', async () => {
      const plan = await createPlan().expect(201);
      await request(app.getHttpServer())
        .patch(`/api/v1/subscription-plans/${plan.body.data.public_id}`)
        .send({ monthly_fee: 399 })
        .expect(401);
    });

    it('rejects a non-SUPER_ADMIN caller', async () => {
      const plan = await createPlan().expect(201);
      await asOwner(
        request(app.getHttpServer()).patch(`/api/v1/subscription-plans/${plan.body.data.public_id}`),
      )
        .send({ monthly_fee: 399 })
        .expect(403);
    });

    it('404s on an unknown plan id', () => {
      return asAdmin(
        request(app.getHttpServer()).patch('/api/v1/subscription-plans/00000000-0000-0000-0000-000000000000'),
      )
        .send(validPlanPayload())
        .expect(404);
    });

    it('updates a plan and persists the change', async () => {
      const plan = await createPlan({ monthly_fee: 299 }).expect(201);

      const res = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/subscription-plans/${plan.body.data.public_id}`),
      )
        .send(toUpdatePayload(plan.body.data, { monthly_fee: 349 }))
        .expect(200);
      expect(Number(res.body.data.monthly_fee)).toBe(349);
    });

    it('rejects missing required fields on update', async () => {
      const plan = await createPlan().expect(201);
      const res = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/subscription-plans/${plan.body.data.public_id}`),
      )
        .send({})
        .expect(400);

      expect(res.body.fields.name).toBeDefined();
      expect(res.body.fields.plan_type).toBeDefined();
      expect(res.body.fields.billing_cycle).toBeDefined();
      expect(res.body.fields.monthly_fee).toBeDefined();
    });

    it('rejects an invalid plan_type/billing_cycle enum value on update', async () => {
      const plan = await createPlan().expect(201);
      const res = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/subscription-plans/${plan.body.data.public_id}`),
      )
        .send(toUpdatePayload(plan.body.data, { plan_type: 'NOT_A_TYPE', billing_cycle: 'NOT_A_CYCLE' }))
        .expect(400);

      expect(res.body.fields.plan_type).toBeDefined();
      expect(res.body.fields.billing_cycle).toBeDefined();
    });

    it('rejects a non-positive monthly_fee on update', async () => {
      const plan = await createPlan().expect(201);
      const res = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/subscription-plans/${plan.body.data.public_id}`),
      )
        .send(toUpdatePayload(plan.body.data, { monthly_fee: -1 }))
        .expect(400);
      expect(res.body.fields.monthly_fee).toBeDefined();
    });

    it('rejects unknown fields on update', async () => {
      const plan = await createPlan().expect(201);
      await asAdmin(request(app.getHttpServer()).patch(`/api/v1/subscription-plans/${plan.body.data.public_id}`))
        .send({ ...toUpdatePayload(plan.body.data), not_a_real_field: 'x' })
        .expect(400);
    });

    it('deactivates a plan via update, reflected in both GET /:id and the list', async () => {
      const plan = await createPlan().expect(201);

      await asAdmin(request(app.getHttpServer()).patch(`/api/v1/subscription-plans/${plan.body.data.public_id}`))
        .send(toUpdatePayload(plan.body.data, { is_active: false }))
        .expect(200);

      const single = await asAdmin(
        request(app.getHttpServer()).get(`/api/v1/subscription-plans/${plan.body.data.public_id}`),
      ).expect(200);
      expect(single.body.data.is_active).toBe(false);

      const list = await asAdmin(request(app.getHttpServer()).get('/api/v1/subscription-plans')).expect(200);
      const item = list.body.data.find((p: any) => p.public_id === plan.body.data.public_id);
      expect(item.is_active).toBe(false);
    });
  });

  describe('is_default_trial exclusivity', () => {
    it('promoting a plan to default trial unsets whichever plan held it before', async () => {
      const planA = await createPlan().expect(201);
      await promoteToDefaultTrial(planA.body.data).expect(200);

      const refetchedA = await asAdmin(
        request(app.getHttpServer()).get(`/api/v1/subscription-plans/${planA.body.data.public_id}`),
      ).expect(200);
      expect(refetchedA.body.data.is_default_trial).toBe(true);

      const planB = await createPlan().expect(201);
      await promoteToDefaultTrial(planB.body.data).expect(200);

      const refetchedAAgain = await asAdmin(
        request(app.getHttpServer()).get(`/api/v1/subscription-plans/${planA.body.data.public_id}`),
      ).expect(200);
      const refetchedB = await asAdmin(
        request(app.getHttpServer()).get(`/api/v1/subscription-plans/${planB.body.data.public_id}`),
      ).expect(200);

      expect(refetchedAAgain.body.data.is_default_trial).toBe(false);
      expect(refetchedB.body.data.is_default_trial).toBe(true);
    });

    it('a plan can unset its own default-trial flag without another plan taking it over', async () => {
      const planA = await createPlan().expect(201);
      await promoteToDefaultTrial(planA.body.data).expect(200);

      await asAdmin(request(app.getHttpServer()).patch(`/api/v1/subscription-plans/${planA.body.data.public_id}`))
        .send(toUpdatePayload(planA.body.data, { is_default_trial: false }))
        .expect(200);

      const all = await asAdmin(request(app.getHttpServer()).get('/api/v1/subscription-plans')).expect(200);
      expect(all.body.data.some((p: any) => p.is_default_trial)).toBe(false);
    });

    it('creating a new plan does not disturb the current default', async () => {
      const defaultPlan = await createPlan().expect(201);
      await promoteToDefaultTrial(defaultPlan.body.data).expect(200);

      await createPlan().expect(201); // brand-new plan, is_default_trial not touched at all

      const refetched = await asAdmin(
        request(app.getHttpServer()).get(`/api/v1/subscription-plans/${defaultPlan.body.data.public_id}`),
      ).expect(200);
      expect(refetched.body.data.is_default_trial).toBe(true);
    });
  });
});
