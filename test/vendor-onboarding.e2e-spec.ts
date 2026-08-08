import { Test, TestingModule } from '@nestjs/testing';
import { ClassSerializerInterceptor, INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { User } from '../src/modules/users/entities/user.entity';
import { Role } from '../src/common/enums/role.enum';
import { OnboardingSource, Vendor, VendorStatus } from '../src/modules/vendors/entities/vendor.entity';
import { SubscriptionStatus, VendorSubscription } from '../src/modules/vendors/entities/vendor-subscription.entity';
import { BillingCycle, PlanType, SubscriptionPlan } from '../src/modules/subscription-plans/entities/subscription-plan.entity';

jest.setTimeout(30000);

describe('Vendor onboarding (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let subscriptionRepo: Repository<VendorSubscription>;
  let planRepo: Repository<SubscriptionPlan>;

  let superAdminToken: string;
  let planId: number;
  let uniqueCounter = 0;

  const ADMIN_EMAIL = 'e2e-admin@spicewallet.test';
  const ADMIN_PASSWORD = 'TestPass123!';

  const validVendorPayload = (overrides: Record<string, unknown> = {}) => {
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
      ...overrides,
    };
  };

  const asAdmin = (req: request.Test) => req.set('Authorization', `Bearer ${superAdminToken}`);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
    await app.init();

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

    const plan = await planRepo.save(
      planRepo.create({
        name: 'Starter Monthly',
        plan_type: PlanType.STARTER,
        billing_cycle: BillingCycle.MONTHLY,
        monthly_fee: 299,
        is_active: true,
      }),
    );
    planId = plan.id_subscription_plan;

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(201);
    superAdminToken = loginRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('happy path', () => {
    let createdVendorId: number;

    it('rejects an unauthenticated onboarding request', () => {
      return request(app.getHttpServer())
        .post('/api/v1/vendors')
        .send(validVendorPayload())
        .expect(401);
    });

    it('onboards a vendor onto an automatic 30-day trial', async () => {
      const res = await asAdmin(request(app.getHttpServer()).post('/api/v1/vendors'))
        .send(validVendorPayload())
        .expect(201);

      expect(res.body.status).toBe(VendorStatus.TRIAL);
      expect(res.body.onboarding_source).toBe(OnboardingSource.SUPER_ADMIN);
      expect(res.body.subscriptions).toHaveLength(1);

      const trialSub = res.body.subscriptions[0];
      expect(trialSub.is_trial).toBe(true);
      expect(trialSub.status).toBe(SubscriptionStatus.ACTIVE);
      expect(trialSub.plan_id).toBeNull();

      const days =
        (new Date(trialSub.end_date).getTime() - new Date(trialSub.start_date).getTime()) / 86_400_000;
      expect(Math.round(days)).toBe(30);

      createdVendorId = res.body.id_vendor;
    });

    it('shows up in the vendor list and single-vendor lookup', async () => {
      const list = await asAdmin(request(app.getHttpServer()).get('/api/v1/vendors')).expect(200);
      expect(list.body.some((v: any) => v.id_vendor === createdVendorId)).toBe(true);

      const single = await asAdmin(
        request(app.getHttpServer()).get(`/api/v1/vendors/${createdVendorId}`),
      ).expect(200);
      expect(single.body.id_vendor).toBe(createdVendorId);
    });

    it('activates the trial vendor onto a paid plan', async () => {
      const res = await asAdmin(
        request(app.getHttpServer()).patch(`/api/v1/vendors/${createdVendorId}/activate`),
      )
        .send({ plan_id: planId })
        .expect(200);

      expect(res.body.status).toBe(VendorStatus.ACTIVE);

      const active = res.body.subscriptions.find((s: any) => s.status === SubscriptionStatus.ACTIVE);
      expect(active.is_trial).toBe(false);
      expect(active.plan.id_subscription_plan).toBe(planId);
      expect(active.end_date).toBeNull();

      const expiredTrial = res.body.subscriptions.find((s: any) => s.is_trial);
      expect(expiredTrial.status).toBe(SubscriptionStatus.EXPIRED);
    });
  });

  describe('validation and duplicate checks', () => {
    it('rejects malformed fields (subdomain, phone, pincode)', () => {
      return asAdmin(request(app.getHttpServer()).post('/api/v1/vendors'))
        .send(validVendorPayload({ subdomain: 'Not Valid!', phone: '123', pincode: 'abc' }))
        .expect(400);
    });

    it('rejects REFERRAL source missing referred_by_vendor_id', () => {
      return asAdmin(request(app.getHttpServer()).post('/api/v1/vendors'))
        .send(validVendorPayload({ onboarding_source: OnboardingSource.REFERRAL }))
        .expect(400);
    });

    it('rejects referred_by_vendor_id set without REFERRAL source', () => {
      return asAdmin(request(app.getHttpServer()).post('/api/v1/vendors'))
        .send(validVendorPayload({ referred_by_vendor_id: 1 }))
        .expect(400);
    });

    it('onboards successfully via REFERRAL when a referring vendor is given', async () => {
      const referrer = await asAdmin(request(app.getHttpServer()).post('/api/v1/vendors'))
        .send(validVendorPayload())
        .expect(201);

      const res = await asAdmin(request(app.getHttpServer()).post('/api/v1/vendors'))
        .send(
          validVendorPayload({
            onboarding_source: OnboardingSource.REFERRAL,
            referred_by_vendor_id: referrer.body.id_vendor,
          }),
        )
        .expect(201);

      expect(res.body.onboarding_source).toBe(OnboardingSource.REFERRAL);
      expect(res.body.referred_by_vendor_id).toBe(referrer.body.id_vendor);
      // onboarded_by_user_id only gets set for direct SUPER_ADMIN onboarding.
      expect(res.body.onboarded_by_user_id).toBeNull();
    });

    it('rejects a duplicate email on an otherwise-valid payload', async () => {
      const first = validVendorPayload();
      await asAdmin(request(app.getHttpServer()).post('/api/v1/vendors')).send(first).expect(201);

      await asAdmin(request(app.getHttpServer()).post('/api/v1/vendors'))
        .send(validVendorPayload({ email: first.email }))
        .expect(409);
    });

    it('rejects a duplicate subdomain on an otherwise-valid payload', async () => {
      const first = validVendorPayload();
      await asAdmin(request(app.getHttpServer()).post('/api/v1/vendors')).send(first).expect(201);

      await asAdmin(request(app.getHttpServer()).post('/api/v1/vendors'))
        .send(validVendorPayload({ subdomain: first.subdomain }))
        .expect(409);
    });
  });

  describe('authorization', () => {
    it('blocks onboarding from a non-SUPER_ADMIN account', async () => {
      const vendor = await vendorRepo.save(
        vendorRepo.create({ ...validVendorPayload(), status: VendorStatus.ACTIVE }),
      );

      const ownerPassword = 'OwnerPass123!';
      const ownerEmail = `owner-${++uniqueCounter}@example.com`;
      await userRepo.save(
        userRepo.create({
          name: 'Shop Owner',
          email: ownerEmail,
          password_hash: await bcrypt.hash(ownerPassword, 10),
          role: Role.VENDOR_OWNER,
          vendor_id: vendor.id_vendor,
          is_active: true,
        }),
      );

      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: ownerEmail, password: ownerPassword })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/vendors')
        .set('Authorization', `Bearer ${login.body.access_token}`)
        .send(validVendorPayload())
        .expect(403);
    });
  });
});
