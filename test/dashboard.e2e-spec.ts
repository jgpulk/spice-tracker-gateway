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
import {
  SubscriptionStatus,
  VendorSubscription,
} from '../src/modules/vendors/entities/vendor-subscription.entity';
import {
  BillingCycle,
  PlanType,
  SubscriptionPlan,
} from '../src/modules/subscription-plans/entities/subscription-plan.entity';

describe('Dashboard — /api/v1/dashboard/super-admin (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let subRepo: Repository<VendorSubscription>;
  let planRepo: Repository<SubscriptionPlan>;

  let superAdminToken: string;
  let vendorOwnerToken: string;
  let warehouseStaffToken: string;
  let uniqueCounter = 0;

  const ADMIN_EMAIL = 'e2e-dash-admin@spicewallet.test';
  const ADMIN_PASSWORD = 'AdminPass123!';
  const OWNER_EMAIL = 'e2e-dash-owner@spicewallet.test';
  const OWNER_PASSWORD = 'OwnerPass123!';
  const STAFF_EMAIL = 'e2e-dash-staff@spicewallet.test';
  const STAFF_PASSWORD = 'StaffPass123!';

  const ENDPOINT = '/api/v1/dashboard/super-admin';

  const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${superAdminToken}`);
  const asOwner = (req: request.Test) => req.set('Authorization', `Bearer ${vendorOwnerToken}`);
  const asStaff = (req: request.Test) => req.set('Authorization', `Bearer ${warehouseStaffToken}`);

  const getStats = async () => {
    const res = await asAdmin(request(app.getHttpServer()).get(ENDPOINT)).expect(200);
    return res.body.data;
  };

  /** 'YYYY-MM-DD' offset from today in whole local days — matches the DATE column precision. */
  const dayOffset = (days: number): string => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const monthKey = (offsetMonths: number): string => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  // The endpoint aggregates across every vendor in the database, so each
  // scenario needs a known world. Users are deliberately NOT truncated —
  // JwtStrategy re-reads the user on every request, so wiping them would
  // invalidate the tokens issued in beforeAll.
  const resetWorld = async () => {
    await vendorRepo.query('SET FOREIGN_KEY_CHECKS = 0');
    await vendorRepo.query('TRUNCATE TABLE vendor_subscriptions');
    await vendorRepo.query('TRUNCATE TABLE vendors');
    await vendorRepo.query('TRUNCATE TABLE subscription_plans');
    await vendorRepo.query('SET FOREIGN_KEY_CHECKS = 1');
  };

  const makePlan = (overrides: Partial<SubscriptionPlan> = {}) => {
    const n = ++uniqueCounter;
    return planRepo.save(
      planRepo.create({
        name: `Dash Plan ${n}`,
        plan_type: PlanType.STARTER,
        billing_cycle: BillingCycle.MONTHLY,
        monthly_fee: 299,
        is_active: true,
        is_default_trial: false,
        is_deleted: false,
        ...overrides,
      }),
    );
  };

  const makeVendor = (status: VendorStatus, overrides: Partial<Vendor> = {}) => {
    const n = ++uniqueCounter;
    return vendorRepo.save(
      vendorRepo.create({
        name: `Dash Vendor ${n}`,
        subdomain: `dash-vendor-${n}`,
        email: `dash-vendor-${n}@example.com`,
        phone: `+9198765${String(n).padStart(5, '0')}`,
        address: '1 Test Street',
        city: 'Kochi',
        state: 'Kerala',
        pincode: '682001',
        status,
        ...overrides,
      }),
    );
  };

  const makeSub = (
    vendor: Vendor,
    opts: {
      plan?: SubscriptionPlan | null;
      status?: SubscriptionStatus;
      is_trial?: boolean;
      end?: string | null;
    } = {},
  ) =>
    subRepo.save(
      subRepo.create({
        vendor_id: vendor.id_vendor,
        plan_id: opts.plan ? opts.plan.id_subscription_plan : null,
        status: opts.status ?? SubscriptionStatus.ACTIVE,
        is_trial: opts.is_trial ?? false,
        start_date: dayOffset(-1) as unknown as Date,
        end_date: (opts.end === undefined ? dayOffset(30) : opts.end) as unknown as Date,
      }),
    );

  /** created_at is a @CreateDateColumn, so it has to be forced with raw SQL. */
  const setCreatedAt = (vendor: Vendor, isoDateTime: string) =>
    vendorRepo.query('UPDATE vendors SET created_at = ? WHERE id_vendor = ?', [
      isoDateTime,
      vendor.id_vendor,
    ]);

  beforeAll(async () => {
    const { app: testApp, moduleFixture } = await createTestApp();
    app = testApp;

    userRepo = moduleFixture.get(getRepositoryToken(User));
    vendorRepo = moduleFixture.get(getRepositoryToken(Vendor));
    subRepo = moduleFixture.get(getRepositoryToken(VendorSubscription));
    planRepo = moduleFixture.get(getRepositoryToken(SubscriptionPlan));

    await vendorRepo.query('SET FOREIGN_KEY_CHECKS = 0');
    await vendorRepo.query('TRUNCATE TABLE vendor_subscriptions');
    await vendorRepo.query('TRUNCATE TABLE vendors');
    await vendorRepo.query('TRUNCATE TABLE subscription_plans');
    await userRepo.query('TRUNCATE TABLE users');
    await vendorRepo.query('SET FOREIGN_KEY_CHECKS = 1');

    await userRepo.save(
      userRepo.create({
        name: 'E2E Dash Admin',
        email: ADMIN_EMAIL,
        password_hash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        role: Role.SUPER_ADMIN,
        vendor_id: null,
        is_active: true,
      }),
    );

    const ownedVendor = await makeVendor(VendorStatus.ACTIVE, {
      name: 'Dash Owner Shop',
      subdomain: 'dash-owner-shop',
      email: 'dash-owner-shop@example.com',
    });

    await userRepo.save(
      userRepo.create({
        name: 'E2E Dash Owner',
        email: OWNER_EMAIL,
        password_hash: await bcrypt.hash(OWNER_PASSWORD, 10),
        role: Role.VENDOR_OWNER,
        vendor_id: ownedVendor.id_vendor,
        is_active: true,
      }),
    );
    await userRepo.save(
      userRepo.create({
        name: 'E2E Dash Staff',
        email: STAFF_EMAIL,
        password_hash: await bcrypt.hash(STAFF_PASSWORD, 10),
        role: Role.WAREHOUSE_STAFF,
        vendor_id: ownedVendor.id_vendor,
        is_active: true,
      }),
    );

    const login = (email: string, password: string) =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(201)
        .then((r) => r.body.data.access_token);

    superAdminToken = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    vendorOwnerToken = await login(OWNER_EMAIL, OWNER_PASSWORD);
    warehouseStaffToken = await login(STAFF_EMAIL, STAFF_PASSWORD);
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------------------------------------------------------------- access

  describe('access control', () => {
    it('rejects an unauthenticated request', () => {
      return request(app.getHttpServer()).get(ENDPOINT).expect(401);
    });

    it('rejects a malformed bearer token', () => {
      return request(app.getHttpServer())
        .get(ENDPOINT)
        .set('Authorization', 'Bearer not.a.real.token')
        .expect(401);
    });

    it('rejects a VENDOR_OWNER — this is platform-wide data', () => {
      return asOwner(request(app.getHttpServer()).get(ENDPOINT)).expect(403);
    });

    it('rejects a WAREHOUSE_STAFF', () => {
      return asStaff(request(app.getHttpServer()).get(ENDPOINT)).expect(403);
    });

    it('allows a SUPER_ADMIN', () => {
      return asAdmin(request(app.getHttpServer()).get(ENDPOINT)).expect(200);
    });
  });

  // ---------------------------------------------------------------- envelope

  describe('response envelope and shape', () => {
    it('wraps the payload in the standard envelope with its own message', async () => {
      const res = await asAdmin(request(app.getHttpServer()).get(ENDPOINT)).expect(200);
      expect(res.body.status).toBe(true);
      expect(res.body.message).toBe('Dashboard stats fetched successfully');
      expect(res.body.data).toBeDefined();
    });

    it('returns exactly the documented top-level sections', async () => {
      const data = await getStats();
      expect(Object.keys(data).sort()).toEqual(
        [
          'attention',
          'generated_at',
          'plan_distribution',
          'revenue',
          'signups_by_month',
          'subscriptions',
          'vendors',
        ].sort(),
      );
    });

    it('returns the documented keys inside each counts section', async () => {
      const data = await getStats();
      expect(Object.keys(data.vendors).sort()).toEqual(
        ['active', 'new_last_month', 'new_this_month', 'suspended', 'total', 'trial'].sort(),
      );
      expect(Object.keys(data.subscriptions).sort()).toEqual(
        [
          'active',
          'expiring_within_7_days',
          'paid',
          'trial',
          'trials_ending_within_7_days',
          'vendors_without_active_subscription',
        ].sort(),
      );
      expect(Object.keys(data.revenue).sort()).toEqual(['arr', 'currency', 'mrr'].sort());
      expect(Object.keys(data.attention).sort()).toEqual(
        ['expiring_soon', 'missing_subscription', 'suspended', 'trials_ending_soon'].sort(),
      );
    });

    it('stamps generated_at as a valid timestamp', async () => {
      const data = await getStats();
      expect(Number.isNaN(Date.parse(data.generated_at))).toBe(false);
    });
  });

  // ---------------------------------------------------------------- main world

  describe('aggregates over a known world', () => {
    // Ten vendors chosen to cover every branch: paid/trial, in and out of the
    // 7-day window, boundary days 0 and 7, a lapsed end_date, a null end_date,
    // an ACTIVE subscription with no plan attached, a suspended vendor, and a
    // vendor with no subscription rows at all.
    beforeAll(async () => {
      await resetWorld();

      const starter = await makePlan({ name: 'Dash Starter', monthly_fee: 299 });
      const pro = await makePlan({
        name: 'Dash Pro',
        plan_type: PlanType.PRO,
        monthly_fee: 800,
      });
      const ent = await makePlan({
        name: 'Dash Enterprise',
        plan_type: PlanType.ENTERPRISE,
        billing_cycle: BillingCycle.ANNUAL,
        monthly_fee: 1500,
      });

      // paid, comfortably in the future
      await makeSub(await makeVendor(VendorStatus.ACTIVE), { plan: pro, end: dayOffset(30) });
      // paid, expiring inside the window
      await makeSub(await makeVendor(VendorStatus.ACTIVE), { plan: pro, end: dayOffset(3) });
      // paid, on the far boundary of the window (day 7 counts)
      await makeSub(await makeVendor(VendorStatus.ACTIVE), { plan: ent, end: dayOffset(7) });
      // trial ending inside the window
      await makeSub(await makeVendor(VendorStatus.TRIAL), {
        plan: starter,
        is_trial: true,
        end: dayOffset(5),
      });
      // trial ending well beyond the window
      await makeSub(await makeVendor(VendorStatus.TRIAL), {
        plan: starter,
        is_trial: true,
        end: dayOffset(20),
      });
      // suspended, its only subscription already EXPIRED
      await makeSub(await makeVendor(VendorStatus.SUSPENDED), {
        plan: pro,
        status: SubscriptionStatus.EXPIRED,
        is_trial: false,
        end: dayOffset(-5),
      });
      // active vendor with no subscription rows whatsoever
      await makeVendor(VendorStatus.ACTIVE);
      // ACTIVE subscription with no plan attached
      await makeSub(await makeVendor(VendorStatus.ACTIVE), { plan: null, end: dayOffset(2) });
      // paid but already lapsed while still flagged ACTIVE
      await makeSub(await makeVendor(VendorStatus.ACTIVE), { plan: pro, end: dayOffset(-2) });
      // paid with an open-ended subscription
      await makeSub(await makeVendor(VendorStatus.ACTIVE), { plan: pro, end: null });
    });

    it('counts vendors by status', async () => {
      const { vendors } = await getStats();
      expect(vendors.total).toBe(10);
      expect(vendors.active).toBe(7);
      expect(vendors.trial).toBe(2);
      expect(vendors.suspended).toBe(1);
      expect(vendors.active + vendors.trial + vendors.suspended).toBe(vendors.total);
    });

    it('counts subscriptions, splitting trial from paid', async () => {
      const { subscriptions } = await getStats();
      // Only status === ACTIVE counts, so the suspended vendor's EXPIRED row is ignored.
      expect(subscriptions.active).toBe(8);
      expect(subscriptions.trial).toBe(2);
      expect(subscriptions.paid).toBe(6);
      expect(subscriptions.trial + subscriptions.paid).toBe(subscriptions.active);
    });

    it('counts only vendors with no ACTIVE subscription as unsubscribed', async () => {
      const { subscriptions } = await getStats();
      // The suspended vendor (EXPIRED row) and the vendor with no rows at all.
      expect(subscriptions.vendors_without_active_subscription).toBe(2);
    });

    it('windows the expiring buckets to 0–7 days and keeps trials separate', async () => {
      const { subscriptions } = await getStats();
      // +2 (no plan), +3 and +7 — the day-7 boundary is inclusive.
      // The -2 lapsed, null end_date, and +30 rows are all excluded.
      expect(subscriptions.expiring_within_7_days).toBe(3);
      expect(subscriptions.trials_ending_within_7_days).toBe(1);
    });

    it('sums MRR from paid active subscriptions only, as a number', async () => {
      const { revenue } = await getStats();
      // 800 + 800 + 1500 + 800 + 800. Trials contribute nothing, and the
      // ACTIVE-but-planless subscription cannot contribute a fee.
      expect(revenue.mrr).toBe(4700);
      expect(revenue.arr).toBe(56400);
      expect(revenue.currency).toBe('INR');
      // monthly_fee is a MySQL decimal returned as a string — if it were not
      // coerced these would concatenate instead of adding.
      expect(typeof revenue.mrr).toBe('number');
      expect(typeof revenue.arr).toBe('number');
    });

    it('groups plan distribution by plan, busiest first', async () => {
      const { plan_distribution } = await getStats();
      expect(plan_distribution.map((p: any) => [p.name, p.vendors])).toEqual([
        ['Dash Pro', 4],
        ['Dash Starter', 2],
        ['Dash Enterprise', 1],
      ]);
    });

    it('exposes plan pricing as a number and omits plans nobody is on', async () => {
      const { plan_distribution } = await getStats();
      const pro = plan_distribution.find((p: any) => p.name === 'Dash Pro');
      expect(pro.monthly_fee).toBe(800);
      expect(typeof pro.monthly_fee).toBe('number');
      expect(pro.plan_type).toBe(PlanType.PRO);
      expect(typeof pro.plan_id).toBe('string');
      // A subscription with no plan contributes no distribution bucket.
      expect(plan_distribution).toHaveLength(3);
    });

    it('lists expiring paid subscriptions soonest-first, tolerating a missing plan', async () => {
      const { attention } = await getStats();
      expect(attention.expiring_soon.map((v: any) => v.days_remaining)).toEqual([2, 3, 7]);
      // The +2 row is the planless one.
      expect(attention.expiring_soon[0].plan_name).toBeNull();
      expect(attention.expiring_soon[1].plan_name).toBe('Dash Pro');
      expect(attention.expiring_soon[2].plan_name).toBe('Dash Enterprise');
    });

    it('returns identifying fields on each attention entry', async () => {
      const { attention } = await getStats();
      const entry = attention.expiring_soon[1];
      expect(Object.keys(entry).sort()).toEqual(
        ['days_remaining', 'expires_at', 'name', 'plan_name', 'vendor_id'].sort(),
      );
      expect(entry.vendor_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(entry.expires_at).toMatch(/^\d{4}-\d{2}-\d{2}/);
    });

    it('separates trials ending soon from paid expiries', async () => {
      const { attention } = await getStats();
      expect(attention.trials_ending_soon).toHaveLength(1);
      expect(attention.trials_ending_soon[0].days_remaining).toBe(5);
      expect(attention.trials_ending_soon[0].plan_name).toBe('Dash Starter');
    });

    it('lists suspended vendors', async () => {
      const { attention } = await getStats();
      expect(attention.suspended).toHaveLength(1);
      expect(attention.suspended[0].status).toBe(VendorStatus.SUSPENDED);
      expect(Object.keys(attention.suspended[0]).sort()).toEqual(
        ['name', 'status', 'vendor_id'].sort(),
      );
    });

    it('flags unsubscribed vendors that are not already suspended', async () => {
      const { attention } = await getStats();
      // Only the vendor with no rows — the suspended one is reported in its own
      // bucket rather than counted twice.
      expect(attention.missing_subscription).toHaveLength(1);
      expect(attention.missing_subscription[0].status).toBe(VendorStatus.ACTIVE);
    });
  });

  // ---------------------------------------------------------------- signups

  describe('signup trend and month-over-month counts', () => {
    beforeAll(async () => {
      await resetWorld();

      const thisMonthA = await makeVendor(VendorStatus.ACTIVE);
      const thisMonthB = await makeVendor(VendorStatus.TRIAL);
      const lastMonth = await makeVendor(VendorStatus.ACTIVE);
      const threeMonthsAgo = await makeVendor(VendorStatus.ACTIVE);
      const wayOutside = await makeVendor(VendorStatus.ACTIVE);

      const now = new Date();
      const atMonth = (offset: number, day: number) => {
        const d = new Date(now.getFullYear(), now.getMonth() + offset, day, 12, 0, 0);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 12:00:00`;
      };

      await setCreatedAt(thisMonthA, atMonth(0, 1));
      await setCreatedAt(thisMonthB, atMonth(0, 1));
      await setCreatedAt(lastMonth, atMonth(-1, 15));
      await setCreatedAt(threeMonthsAgo, atMonth(-3, 10));
      // Older than the 12-month window, so it must not appear in the trend.
      await setCreatedAt(wayOutside, atMonth(-20, 10));
    });

    it('counts signups for the current and previous month', async () => {
      const { vendors } = await getStats();
      expect(vendors.total).toBe(5);
      expect(vendors.new_this_month).toBe(2);
      expect(vendors.new_last_month).toBe(1);
    });

    it('returns 12 zero-filled months, oldest first, ending with the current month', async () => {
      const { signups_by_month } = await getStats();
      expect(signups_by_month).toHaveLength(12);
      expect(signups_by_month[11].month).toBe(monthKey(0));
      expect(signups_by_month[0].month).toBe(monthKey(-11));
      signups_by_month.forEach((m: any) => expect(m.month).toMatch(/^\d{4}-\d{2}$/));
    });

    it('places each signup in its own month bucket and ignores anything older', async () => {
      const { signups_by_month } = await getStats();
      const at = (offset: number) =>
        signups_by_month.find((m: any) => m.month === monthKey(offset))?.count;

      expect(at(0)).toBe(2);
      expect(at(-1)).toBe(1);
      expect(at(-2)).toBe(0);
      expect(at(-3)).toBe(1);
      // The 20-month-old vendor still counts in the total but not in the trend.
      const trendTotal = signups_by_month.reduce((s: number, m: any) => s + m.count, 0);
      expect(trendTotal).toBe(4);
    });
  });

  // ---------------------------------------------------------------- empty

  describe('with no vendors at all', () => {
    beforeAll(async () => {
      await resetWorld();
    });

    it('returns zeroed counts rather than nulls', async () => {
      const { vendors, subscriptions } = await getStats();
      expect(vendors).toEqual({
        total: 0,
        active: 0,
        trial: 0,
        suspended: 0,
        new_this_month: 0,
        new_last_month: 0,
      });
      expect(subscriptions).toEqual({
        active: 0,
        trial: 0,
        paid: 0,
        expiring_within_7_days: 0,
        trials_ending_within_7_days: 0,
        vendors_without_active_subscription: 0,
      });
    });

    it('reports zero revenue and empty collections', async () => {
      const { revenue, plan_distribution, attention } = await getStats();
      expect(revenue).toEqual({ currency: 'INR', mrr: 0, arr: 0 });
      expect(plan_distribution).toEqual([]);
      expect(attention.expiring_soon).toEqual([]);
      expect(attention.trials_ending_soon).toEqual([]);
      expect(attention.suspended).toEqual([]);
      expect(attention.missing_subscription).toEqual([]);
    });

    it('still returns the full 12-month trend, all zeros', async () => {
      const { signups_by_month } = await getStats();
      expect(signups_by_month).toHaveLength(12);
      expect(signups_by_month.every((m: any) => m.count === 0)).toBe(true);
    });
  });
});
