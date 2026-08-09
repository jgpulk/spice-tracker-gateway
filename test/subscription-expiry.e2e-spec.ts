import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createTestApp } from './utils/test-app';
import { CronService } from '../src/modules/cron/cron.service';
import { Vendor, VendorStatus } from '../src/modules/vendors/entities/vendor.entity';
import { SubscriptionStatus, VendorSubscription } from '../src/modules/vendors/entities/vendor-subscription.entity';
import { BillingCycle, PlanType, SubscriptionPlan } from '../src/modules/subscription-plans/entities/subscription-plan.entity';

// expireSubscriptions() is a @Cron job, not reachable over HTTP — it's
// exercised by calling the service method directly against the real DB via
// the Nest DI container, same underlying test app as every other suite.
describe('CronService.expireSubscriptions (cron, e2e)', () => {
  let app: INestApplication;
  let cronService: CronService;
  let vendorRepo: Repository<Vendor>;
  let subscriptionRepo: Repository<VendorSubscription>;
  let planRepo: Repository<SubscriptionPlan>;

  let uniqueCounter = 0;

  const validVendorPayload = (overrides: Record<string, unknown> = {}): Record<string, any> => {
    const n = ++uniqueCounter;
    return {
      name: `Expiry Test Shop ${n}`,
      subdomain: `expiry-test-shop-${n}`,
      email: `expiry-shop-${n}@example.com`,
      phone: `+9198763${String(40000 + n).padStart(5, '0')}`,
      address: '1 Test Street',
      city: 'Kochi',
      state: 'Kerala',
      pincode: '682001',
      business_reg_no: `29EXPIRYTEST${String(n).padStart(4, '0')}`,
      business_type: 'Sole Proprietorship',
      ...overrides,
    };
  };

  const daysFromNow = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  };

  const makeVendor = (status: VendorStatus) =>
    vendorRepo.save(vendorRepo.create({ ...validVendorPayload(), status }));

  const makeSubscription = (
    vendorId: number,
    overrides: Partial<VendorSubscription> = {},
  ) =>
    subscriptionRepo.save(
      subscriptionRepo.create({
        vendor_id: vendorId,
        plan_id: null,
        is_trial: true,
        status: SubscriptionStatus.ACTIVE,
        start_date: daysFromNow(-30),
        end_date: daysFromNow(-1), // expired yesterday, by default
        ...overrides,
      }),
    );

  let consoleLogSpy: jest.SpyInstance;

  beforeAll(async () => {
    const { app: testApp, moduleFixture } = await createTestApp();
    app = testApp;

    cronService = moduleFixture.get(CronService);
    vendorRepo = moduleFixture.get(getRepositoryToken(Vendor));
    subscriptionRepo = moduleFixture.get(getRepositoryToken(VendorSubscription));
    planRepo = moduleFixture.get(getRepositoryToken(SubscriptionPlan));

    // Reset to a clean slate — this schema is dedicated to e2e runs (see .env.test).
    await subscriptionRepo.query('SET FOREIGN_KEY_CHECKS = 0');
    await subscriptionRepo.query('TRUNCATE TABLE vendor_subscriptions');
    await vendorRepo.query('TRUNCATE TABLE vendors');
    await subscriptionRepo.query('SET FOREIGN_KEY_CHECKS = 1');

    // expireSubscriptions() logs on every real run — that's useful in
    // production but just noise here, and it's easy to mistake for a test
    // failure in the console output. Silence it for this suite only.
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterAll(async () => {
    consoleLogSpy.mockRestore();
    await app.close();
  });

  it("suspends a TRIAL vendor whose trial subscription's end_date has passed", async () => {
    const vendor = await makeVendor(VendorStatus.TRIAL);
    const sub = await makeSubscription(vendor.id_vendor, { is_trial: true });

    await cronService.expireSubscriptions();

    const updatedVendor = await vendorRepo.findOneBy({ id_vendor: vendor.id_vendor });
    const updatedSub = await subscriptionRepo.findOneBy({ id_vendor_subscription: sub.id_vendor_subscription });

    expect(updatedVendor!.status).toBe(VendorStatus.SUSPENDED);
    expect(updatedSub!.status).toBe(SubscriptionStatus.EXPIRED);
  });

  it('suspends a paying ACTIVE vendor whose paid subscription end_date has passed (not just trials)', async () => {
    const plan = await planRepo.save(
      planRepo.create({
        name: 'Expiry Test Plan',
        plan_type: PlanType.STARTER,
        billing_cycle: BillingCycle.MONTHLY,
        monthly_fee: 299,
        is_active: true,
      }),
    );
    const vendor = await makeVendor(VendorStatus.ACTIVE);
    const sub = await makeSubscription(vendor.id_vendor, { is_trial: false, plan_id: plan.id_subscription_plan });

    await cronService.expireSubscriptions();

    const updatedVendor = await vendorRepo.findOneBy({ id_vendor: vendor.id_vendor });
    const updatedSub = await subscriptionRepo.findOneBy({ id_vendor_subscription: sub.id_vendor_subscription });

    expect(updatedVendor!.status).toBe(VendorStatus.SUSPENDED);
    expect(updatedSub!.status).toBe(SubscriptionStatus.EXPIRED);
  });

  it('leaves a vendor untouched whose active subscription has not expired yet', async () => {
    const vendor = await makeVendor(VendorStatus.ACTIVE);
    const sub = await makeSubscription(vendor.id_vendor, {
      is_trial: false,
      start_date: daysFromNow(-1),
      end_date: daysFromNow(29), // still 29 days out
    });

    await cronService.expireSubscriptions();

    const updatedVendor = await vendorRepo.findOneBy({ id_vendor: vendor.id_vendor });
    const updatedSub = await subscriptionRepo.findOneBy({ id_vendor_subscription: sub.id_vendor_subscription });

    expect(updatedVendor!.status).toBe(VendorStatus.ACTIVE);
    expect(updatedSub!.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it('never expires a subscription with a null (permanent) end_date', async () => {
    const vendor = await makeVendor(VendorStatus.ACTIVE);
    const sub = await makeSubscription(vendor.id_vendor, { is_trial: false, end_date: null });

    await cronService.expireSubscriptions();

    const updatedVendor = await vendorRepo.findOneBy({ id_vendor: vendor.id_vendor });
    const updatedSub = await subscriptionRepo.findOneBy({ id_vendor_subscription: sub.id_vendor_subscription });

    expect(updatedVendor!.status).toBe(VendorStatus.ACTIVE);
    expect(updatedSub!.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it('documents current behavior: an already-SUSPENDED vendor is skipped entirely, even with a stale expired-but-still-ACTIVE subscription row', async () => {
    // The cron filters out vendors already SUSPENDED before touching their
    // subscriptions, so a subscription row left ACTIVE+expired on an
    // already-suspended vendor is never flipped to EXPIRED by this job.
    const vendor = await makeVendor(VendorStatus.SUSPENDED);
    const sub = await makeSubscription(vendor.id_vendor, { is_trial: false });

    await cronService.expireSubscriptions();

    const updatedVendor = await vendorRepo.findOneBy({ id_vendor: vendor.id_vendor });
    const updatedSub = await subscriptionRepo.findOneBy({ id_vendor_subscription: sub.id_vendor_subscription });

    expect(updatedVendor!.status).toBe(VendorStatus.SUSPENDED);
    expect(updatedSub!.status).toBe(SubscriptionStatus.ACTIVE); // left as-is, not EXPIRED
  });

  it('processes multiple expired vendors in a single run without affecting each other', async () => {
    const vendorA = await makeVendor(VendorStatus.TRIAL);
    const subA = await makeSubscription(vendorA.id_vendor);
    const vendorB = await makeVendor(VendorStatus.ACTIVE);
    const subB = await makeSubscription(vendorB.id_vendor, { is_trial: false });
    const untouchedVendor = await makeVendor(VendorStatus.ACTIVE);
    const untouchedSub = await makeSubscription(untouchedVendor.id_vendor, {
      is_trial: false,
      end_date: daysFromNow(10),
    });

    await cronService.expireSubscriptions();

    expect((await vendorRepo.findOneBy({ id_vendor: vendorA.id_vendor }))!.status).toBe(VendorStatus.SUSPENDED);
    expect((await subscriptionRepo.findOneBy({ id_vendor_subscription: subA.id_vendor_subscription }))!.status).toBe(
      SubscriptionStatus.EXPIRED,
    );

    expect((await vendorRepo.findOneBy({ id_vendor: vendorB.id_vendor }))!.status).toBe(VendorStatus.SUSPENDED);
    expect((await subscriptionRepo.findOneBy({ id_vendor_subscription: subB.id_vendor_subscription }))!.status).toBe(
      SubscriptionStatus.EXPIRED,
    );

    expect((await vendorRepo.findOneBy({ id_vendor: untouchedVendor.id_vendor }))!.status).toBe(
      VendorStatus.ACTIVE,
    );
    expect(
      (await subscriptionRepo.findOneBy({ id_vendor_subscription: untouchedSub.id_vendor_subscription }))!.status,
    ).toBe(SubscriptionStatus.ACTIVE);
  });
});
