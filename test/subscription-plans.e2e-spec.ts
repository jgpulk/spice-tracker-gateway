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

  // POST /subscription-plans returns no data (just a success message — see
  // the dedicated response-shape test below), so any test that needs the
  // created plan's data has to look it up afterward, same pattern as
  // onboardVendor() in the vendors suites.
  const createPlan = (overrides: Record<string, unknown> = {}) =>
    asAdmin(request(app.getHttpServer()).post('/api/v1/subscription-plans')).send(validPlanPayload(overrides));

  const onboardPlan = async (overrides: Record<string, unknown> = {}) => {
    const payload = validPlanPayload(overrides);
    await createPlan(payload).expect(201);
    const row = await planRepo.findOneBy({ name: payload.name });
    return asAdmin(request(app.getHttpServer()).get(`/api/v1/subscription-plans/${row!.public_id}`)).expect(200);
  };

  // UpdateSubscriptionPlanDto is a standalone DTO (no longer extends
  // CreateSubscriptionPlanDto) and only declares name, plan_type,
  // description, is_active — billing_cycle, monthly_fee, and is_default_trial
  // are not updatable at all via the API; sending any of them is rejected as
  // an unknown field, not silently ignored.
  const toUpdatePayload = (plan: any, overrides: Record<string, unknown> = {}) => ({
    name: plan.name,
    plan_type: plan.plan_type,
    is_active: plan.is_active,
    ...(plan.description ? { description: plan.description } : {}),
    ...overrides,
  });

  // PATCH /subscription-plans/:id also returns no data — patch, then fetch.
  const patchPlan = async (publicId: string, payload: Record<string, unknown>) => {
    await asAdmin(request(app.getHttpServer()).patch(`/api/v1/subscription-plans/${publicId}`))
      .send(payload)
      .expect(200);
    return asAdmin(request(app.getHttpServer()).get(`/api/v1/subscription-plans/${publicId}`)).expect(200);
  };

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

    it('returns no data payload on creation, only a success message', async () => {
      const res = await createPlan().expect(201);
      expect(res.body).toEqual({ status: true, message: 'Subscription plan created successfully' });
      expect(res.body.data).toBeUndefined();
    });

    it('creates a plan with defaults applied', async () => {
      const fetched = await onboardPlan();

      const plan = fetched.body.data;
      expect(plan.id_subscription_plan).toBeUndefined(); // internal PK must never leak
      expect(plan.public_id).toBeDefined();
      expect(plan.is_active).toBe(true); // defaults to true when omitted
      expect(plan.is_default_trial).toBe(false); // always false on create — see below
    });

    it('persists every provided field exactly as sent', async () => {
      const fetched = await onboardPlan({
        name: 'Full Field Plan',
        plan_type: PlanType.PRO,
        billing_cycle: BillingCycle.ANNUAL,
        monthly_fee: 299.99,
        description: 'Full description text',
        is_active: true,
      });

      const plan = fetched.body.data;
      expect(plan.name).toBe('Full Field Plan');
      expect(plan.plan_type).toBe(PlanType.PRO);
      expect(plan.billing_cycle).toBe(BillingCycle.ANNUAL);
      expect(Number(plan.monthly_fee)).toBe(299.99);
      expect(plan.description).toBe('Full description text');
      expect(plan.is_active).toBe(true);
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

    it('rejects an empty string name', async () => {
      const res = await createPlan({ name: '' }).expect(400);
      expect(res.body.fields.name).toBeDefined();
    });

    it('rejects a name shorter than 2 characters', async () => {
      const res = await createPlan({ name: 'X' }).expect(400);
      expect(res.body.fields.name).toBeDefined();
    });

    it('rejects a name longer than 100 characters', async () => {
      const res = await createPlan({ name: 'A'.repeat(101) }).expect(400);
      expect(res.body.fields.name).toBeDefined();
    });

    it('rejects a non-string name', async () => {
      const res = await createPlan({ name: 12345 }).expect(400);
      expect(res.body.fields.name).toBeDefined();
    });

    it('accepts a name at the exact boundary lengths (2 and 100 characters)', async () => {
      await createPlan({ name: 'AB' }).expect(201);
      await createPlan({ name: 'C'.repeat(100) }).expect(201);
    });

    it('rejects an invalid plan_type/billing_cycle enum value', async () => {
      const res = await createPlan({ plan_type: 'NOT_A_TYPE', billing_cycle: 'NOT_A_CYCLE' }).expect(400);
      expect(res.body.fields.plan_type).toBeDefined();
      expect(res.body.fields.billing_cycle).toBeDefined();
    });

    it('accepts every valid plan_type and billing_cycle combination', async () => {
      for (const plan_type of Object.values(PlanType)) {
        for (const billing_cycle of Object.values(BillingCycle)) {
          await createPlan({ plan_type, billing_cycle }).expect(201);
        }
      }
    });

    it('rejects a non-positive monthly_fee (zero and negative)', async () => {
      const zero = await createPlan({ monthly_fee: 0 }).expect(400);
      expect(zero.body.fields.monthly_fee).toBeDefined();

      const negative = await createPlan({ monthly_fee: -50 }).expect(400);
      expect(negative.body.fields.monthly_fee).toBeDefined();
    });

    it('rejects a non-numeric monthly_fee', async () => {
      const res = await createPlan({ monthly_fee: 'not-a-number' }).expect(400);
      expect(res.body.fields.monthly_fee).toBeDefined();
    });

    it('accepts a decimal monthly_fee', async () => {
      const fetched = await onboardPlan({ monthly_fee: 149.5 });
      expect(Number(fetched.body.data.monthly_fee)).toBe(149.5);
    });

    it('rejects a non-string description', async () => {
      const res = await createPlan({ description: 12345 }).expect(400);
      expect(res.body.fields.description).toBeDefined();
    });

    it('omitting description leaves it null', async () => {
      const fetched = await onboardPlan();
      expect(fetched.body.data.description).toBeNull();
    });

    it('rejects a non-boolean is_active value', async () => {
      const res = await createPlan({ is_active: 'yes' }).expect(400);
      expect(res.body.fields.is_active).toBeDefined();
    });

    it('creates successfully with is_active explicitly set to true', async () => {
      const fetched = await onboardPlan({ is_active: true });
      expect(fetched.body.data.is_active).toBe(true);
    });

    it('creates successfully with is_active explicitly set to false', async () => {
      const fetched = await onboardPlan({ is_active: false });
      expect(fetched.body.data.is_active).toBe(false);
    });

    it('rejects unknown fields on the DTO', () => {
      return createPlan({ not_a_real_field: 'x' }).expect(400);
    });

    it('rejects is_default_trial on create — there is no API-facing way to set it at all (see below)', () => {
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
      const plan = await onboardPlan({ description: 'A described plan' });

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
      const active = await onboardPlan();
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

    it('excludes soft-deleted plans from the list — unlike is_active: false, this one really is filtered', async () => {
      const kept = await onboardPlan();
      const deleted = await planRepo.save(
        planRepo.create({
          name: 'Soft Deleted Plan',
          plan_type: PlanType.STARTER,
          billing_cycle: BillingCycle.MONTHLY,
          monthly_fee: 149,
          is_deleted: true,
        }),
      );

      const res = await asAdmin(request(app.getHttpServer()).get('/api/v1/subscription-plans')).expect(200);
      const ids = res.body.data.map((p: any) => p.public_id);

      expect(ids).toContain(kept.body.data.public_id);
      expect(ids).not.toContain(deleted.public_id);
    });

    it('orders by plan_type (STARTER, PRO, ENTERPRISE — MySQL ENUM definition order, not alphabetical) then monthly_fee ascending', async () => {
      // plan_type is a MySQL `enum` column, so ASC ordering follows the
      // enum's declared member order (STARTER, PRO, ENTERPRISE) rather than
      // alphabetical order (which would put ENTERPRISE first) — a
      // non-obvious, DB-column-type-dependent behavior worth locking down.
      const enterprise = await onboardPlan({ plan_type: PlanType.ENTERPRISE, monthly_fee: 999 });
      const starterCheap = await onboardPlan({ plan_type: PlanType.STARTER, monthly_fee: 99 });
      const pro = await onboardPlan({ plan_type: PlanType.PRO, monthly_fee: 499 });
      const starterExpensive = await onboardPlan({ plan_type: PlanType.STARTER, monthly_fee: 399 });

      const res = await asAdmin(request(app.getHttpServer()).get('/api/v1/subscription-plans')).expect(200);
      const ids = [
        starterCheap.body.data.public_id,
        starterExpensive.body.data.public_id,
        pro.body.data.public_id,
        enterprise.body.data.public_id,
      ];
      const relevantOrder = res.body.data.map((p: any) => p.public_id).filter((id: string) => ids.includes(id));

      expect(relevantOrder).toEqual(ids);
    });
  });

  describe('GET /subscription-plans/:id', () => {
    it('rejects an unauthenticated request', async () => {
      const plan = await onboardPlan();
      await request(app.getHttpServer())
        .get(`/api/v1/subscription-plans/${plan.body.data.public_id}`)
        .expect(401);
    });

    it('rejects a non-SUPER_ADMIN caller', async () => {
      const plan = await onboardPlan();
      await asOwner(
        request(app.getHttpServer()).get(`/api/v1/subscription-plans/${plan.body.data.public_id}`),
      ).expect(403);
    });

    it('fetches a plan by public_id, wrapped in the standard success envelope', async () => {
      const payload = validPlanPayload({ name: 'Fetchable Plan' });
      await createPlan(payload).expect(201);
      const row = await planRepo.findOneBy({ name: payload.name });

      const res = await asAdmin(
        request(app.getHttpServer()).get(`/api/v1/subscription-plans/${row!.public_id}`),
      ).expect(200);

      expect(res.body.status).toBe(true);
      expect(res.body.message).toBe('Subscription plan fetched successfully');
      expect(res.body.data.name).toBe('Fetchable Plan');
    });

    it('returns every field exactly as created, including null description when omitted', async () => {
      const fetched = await onboardPlan({
        name: 'Full Detail Plan',
        plan_type: PlanType.ENTERPRISE,
        billing_cycle: BillingCycle.ANNUAL,
        monthly_fee: 1999.5,
      });

      const plan = fetched.body.data;
      expect(plan.name).toBe('Full Detail Plan');
      expect(plan.plan_type).toBe(PlanType.ENTERPRISE);
      expect(plan.billing_cycle).toBe(BillingCycle.ANNUAL);
      expect(Number(plan.monthly_fee)).toBe(1999.5);
      expect(plan.description).toBeNull(); // omitted on create
      expect(plan.is_active).toBe(true);
      expect(plan.is_default_trial).toBe(false);
    });

    it('returns a curated shape — no internal PK, no timestamps', async () => {
      const plan = await onboardPlan({ description: 'A described plan' });

      expect(Object.keys(plan.body.data).sort()).toEqual(
        ['billing_cycle', 'description', 'is_active', 'is_default_trial', 'monthly_fee', 'name', 'plan_type', 'public_id'].sort(),
      );
      expect(plan.body.data.id_subscription_plan).toBeUndefined();
      expect(plan.body.data.created_at).toBeUndefined();
      expect(plan.body.data.updated_at).toBeUndefined();
    });

    it('reflects is_active: false for a deactivated plan (fetchable directly even though the list would still show it too)', async () => {
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

    it('reflects is_default_trial: true for the plan currently flagged as the default trial', async () => {
      const defaultPlan = await planRepo.save(
        planRepo.create({
          name: 'Current Default Trial Plan',
          plan_type: PlanType.STARTER,
          billing_cycle: BillingCycle.MONTHLY,
          monthly_fee: 0,
          is_active: true,
          is_default_trial: true,
        }),
      );

      const res = await asAdmin(
        request(app.getHttpServer()).get(`/api/v1/subscription-plans/${defaultPlan.public_id}`),
      ).expect(200);
      expect(res.body.data.is_default_trial).toBe(true);
    });

    it('404s on an unknown (but well-formed) plan id', () => {
      return asAdmin(
        request(app.getHttpServer()).get('/api/v1/subscription-plans/00000000-0000-0000-0000-000000000000'),
      ).expect(404);
    });

    it('404s (not 400 or 500) on a malformed, non-UUID plan id', () => {
      return asAdmin(request(app.getHttpServer()).get('/api/v1/subscription-plans/not-a-valid-uuid')).expect(
        404,
      );
    });

    it('404s on a soft-deleted plan — hidden from single-fetch just like the list', async () => {
      const deleted = await planRepo.save(
        planRepo.create({
          name: 'Deleted And Unfetchable',
          plan_type: PlanType.STARTER,
          billing_cycle: BillingCycle.MONTHLY,
          monthly_fee: 149,
          is_deleted: true,
        }),
      );

      await asAdmin(
        request(app.getHttpServer()).get(`/api/v1/subscription-plans/${deleted.public_id}`),
      ).expect(404);
    });
  });

  describe('PATCH /subscription-plans/:id', () => {
    it('rejects an unauthenticated request', async () => {
      const plan = await onboardPlan();
      await request(app.getHttpServer())
        .patch(`/api/v1/subscription-plans/${plan.body.data.public_id}`)
        .send(toUpdatePayload(plan.body.data))
        .expect(401);
    });

    it('rejects a non-SUPER_ADMIN caller', async () => {
      const plan = await onboardPlan();
      await asOwner(
        request(app.getHttpServer()).patch(`/api/v1/subscription-plans/${plan.body.data.public_id}`),
      )
        .send(toUpdatePayload(plan.body.data))
        .expect(403);
    });

    it('404s on an unknown plan id', () => {
      return asAdmin(
        request(app.getHttpServer()).patch('/api/v1/subscription-plans/00000000-0000-0000-0000-000000000000'),
      )
        .send({ name: 'Valid Name', plan_type: PlanType.STARTER, is_active: true })
        .expect(404);
    });

    it('returns no data payload on update, only a success message', async () => {
      const plan = await onboardPlan();
      const res = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/subscription-plans/${plan.body.data.public_id}`),
      )
        .send(toUpdatePayload(plan.body.data, { name: 'Renamed Plan' }))
        .expect(200);

      expect(res.body).toEqual({ status: true, message: 'Subscription plan updated successfully' });
      expect(res.body.data).toBeUndefined();
    });

    it('updates a plan and persists the change', async () => {
      const plan = await onboardPlan();

      const fetched = await patchPlan(
        plan.body.data.public_id,
        toUpdatePayload(plan.body.data, { name: 'Updated Name' }),
      );
      expect(fetched.body.data.name).toBe('Updated Name');
    });

    it('rejects missing required fields on update', async () => {
      const plan = await onboardPlan();
      const res = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/subscription-plans/${plan.body.data.public_id}`),
      )
        .send({})
        .expect(400);

      expect(res.body.fields.name).toBeDefined();
      expect(res.body.fields.plan_type).toBeDefined();
      expect(res.body.fields.is_active).toBeDefined();
    });

    it('rejects an invalid plan_type enum value on update', async () => {
      const plan = await onboardPlan();
      const res = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/subscription-plans/${plan.body.data.public_id}`),
      )
        .send(toUpdatePayload(plan.body.data, { plan_type: 'NOT_A_TYPE' }))
        .expect(400);
      expect(res.body.fields.plan_type).toBeDefined();
    });

    it('rejects a name shorter than 2 characters on update', async () => {
      const plan = await onboardPlan();
      const res = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/subscription-plans/${plan.body.data.public_id}`),
      )
        .send(toUpdatePayload(plan.body.data, { name: 'X' }))
        .expect(400);
      expect(res.body.fields.name).toBeDefined();
    });

    it('rejects a non-boolean is_active value on update', async () => {
      const plan = await onboardPlan();
      const res = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/subscription-plans/${plan.body.data.public_id}`),
      )
        .send(toUpdatePayload(plan.body.data, { is_active: 'yes' }))
        .expect(400);
      expect(res.body.fields.is_active).toBeDefined();
    });

    it('rejects billing_cycle/monthly_fee as unknown fields on update — price and cycle are not editable after creation', async () => {
      const plan = await onboardPlan();
      await asAdmin(request(app.getHttpServer()).patch(`/api/v1/subscription-plans/${plan.body.data.public_id}`))
        .send({
          ...toUpdatePayload(plan.body.data),
          billing_cycle: BillingCycle.ANNUAL,
          monthly_fee: 999,
        })
        .expect(400);
    });

    it('rejects unknown fields on update', async () => {
      const plan = await onboardPlan();
      await asAdmin(request(app.getHttpServer()).patch(`/api/v1/subscription-plans/${plan.body.data.public_id}`))
        .send({ ...toUpdatePayload(plan.body.data), not_a_real_field: 'x' })
        .expect(400);
    });

    it('deactivates a plan via update, reflected in both GET /:id and the list', async () => {
      const plan = await onboardPlan();

      const fetched = await patchPlan(
        plan.body.data.public_id,
        toUpdatePayload(plan.body.data, { is_active: false }),
      );
      expect(fetched.body.data.is_active).toBe(false);

      const list = await asAdmin(request(app.getHttpServer()).get('/api/v1/subscription-plans')).expect(200);
      const item = list.body.data.find((p: any) => p.public_id === plan.body.data.public_id);
      expect(item.is_active).toBe(false);
    });

    it('rejects is_default_trial as an unknown field on update — same as create, it has no API-facing setter', async () => {
      const plan = await onboardPlan();
      await asAdmin(request(app.getHttpServer()).patch(`/api/v1/subscription-plans/${plan.body.data.public_id}`))
        .send({ ...toUpdatePayload(plan.body.data), is_default_trial: true })
        .expect(400);
    });

    it('rejects updating a soft-deleted plan', async () => {
      const deleted = await planRepo.save(
        planRepo.create({
          name: 'Deleted, Cannot Update',
          plan_type: PlanType.STARTER,
          billing_cycle: BillingCycle.MONTHLY,
          monthly_fee: 149,
          is_deleted: true,
        }),
      );

      // update()'s own lookup does NOT filter is_deleted (unlike findOne()),
      // so this reaches the explicit is_deleted guard and 400s — it does not
      // 404 the way GET/activate do for deleted plans.
      const res = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/subscription-plans/${deleted.public_id}`),
      )
        .send({ name: 'Renamed', plan_type: PlanType.STARTER, is_active: true })
        .expect(400);
      expect(res.body.message).toMatch(/deleted/i);
    });
  });

  describe('DELETE /subscription-plans/:id', () => {
    it('rejects an unauthenticated request', async () => {
      const plan = await onboardPlan();
      await request(app.getHttpServer())
        .delete(`/api/v1/subscription-plans/${plan.body.data.public_id}`)
        .expect(401);
    });

    it('rejects a non-SUPER_ADMIN caller', async () => {
      const plan = await onboardPlan();
      await asOwner(
        request(app.getHttpServer()).delete(`/api/v1/subscription-plans/${plan.body.data.public_id}`),
      ).expect(403);
    });

    it('404s on an unknown plan id', () => {
      return asAdmin(
        request(app.getHttpServer()).delete('/api/v1/subscription-plans/00000000-0000-0000-0000-000000000000'),
      ).expect(404);
    });

    it('returns no data payload on delete, only a success message', async () => {
      const plan = await onboardPlan();
      const res = await asAdmin(
        request(app.getHttpServer()).delete(`/api/v1/subscription-plans/${plan.body.data.public_id}`),
      ).expect(200);

      expect(res.body).toEqual({ status: true, message: 'Subscription plan deleted successfully' });
      expect(res.body.data).toBeUndefined();
    });

    it('soft-deletes: sets is_deleted true AND forces is_active false', async () => {
      const plan = await onboardPlan({ is_active: true });

      await asAdmin(
        request(app.getHttpServer()).delete(`/api/v1/subscription-plans/${plan.body.data.public_id}`),
      ).expect(200);

      const row = await planRepo.findOneBy({ public_id: plan.body.data.public_id });
      expect(row!.is_deleted).toBe(true);
      expect(row!.is_active).toBe(false);
    });

    it('hides the deleted plan from both GET /:id and the list afterward', async () => {
      const plan = await onboardPlan();
      await asAdmin(
        request(app.getHttpServer()).delete(`/api/v1/subscription-plans/${plan.body.data.public_id}`),
      ).expect(200);

      await asAdmin(
        request(app.getHttpServer()).get(`/api/v1/subscription-plans/${plan.body.data.public_id}`),
      ).expect(404);

      const list = await asAdmin(request(app.getHttpServer()).get('/api/v1/subscription-plans')).expect(200);
      expect(list.body.data.some((p: any) => p.public_id === plan.body.data.public_id)).toBe(false);
    });

    it('404s when deleting an already-deleted plan — not idempotent-200', async () => {
      const plan = await onboardPlan();
      await asAdmin(
        request(app.getHttpServer()).delete(`/api/v1/subscription-plans/${plan.body.data.public_id}`),
      ).expect(200);

      await asAdmin(
        request(app.getHttpServer()).delete(`/api/v1/subscription-plans/${plan.body.data.public_id}`),
      ).expect(404);
    });

    it('a deleted plan can no longer be updated afterward', async () => {
      const plan = await onboardPlan();
      await asAdmin(
        request(app.getHttpServer()).delete(`/api/v1/subscription-plans/${plan.body.data.public_id}`),
      ).expect(200);

      const res = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/subscription-plans/${plan.body.data.public_id}`),
      )
        .send(toUpdatePayload(plan.body.data))
        .expect(400);
      expect(res.body.message).toMatch(/deleted/i);
    });
  });

  // is_default_trial can no longer be set through the API at all — neither
  // POST nor PATCH declares the field anymore, so both reject it as unknown
  // (see the two tests above). The only way to flag a plan as the default
  // trial plan right now is a direct DB write, which is exactly what the
  // vendor-onboarding/vendors-list suites do to test that allocation feature.
  // Flagging this in case it's an unintentional regression rather than a
  // deliberate move to "admin-managed outside the API for now" — the vendor
  // onboarding flow actively depends on this flag being set by someone,
  // somehow.
  describe('is_default_trial (no longer settable via the API)', () => {
    it('a plan created via the API always starts with is_default_trial: false, regardless of any prior default', async () => {
      const existingDefault = await planRepo.save(
        planRepo.create({
          name: 'Existing Default Trial Plan',
          plan_type: PlanType.STARTER,
          billing_cycle: BillingCycle.MONTHLY,
          monthly_fee: 0,
          is_active: true,
          is_default_trial: true,
        }),
      );

      const newPlan = await onboardPlan();
      expect(newPlan.body.data.is_default_trial).toBe(false);

      // ...and creating it did not disturb the existing default, since
      // create() never touches is_default_trial for any other row.
      const refetchedExisting = await asAdmin(
        request(app.getHttpServer()).get(`/api/v1/subscription-plans/${existingDefault.public_id}`),
      ).expect(200);
      expect(refetchedExisting.body.data.is_default_trial).toBe(true);
    });
  });
});
