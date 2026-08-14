import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Vendor, OnboardingSource, VendorStatus } from './entities/vendor.entity';
import { SubscriptionStatus, VendorSubscription } from './entities/vendor-subscription.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../../common/enums/role.enum';
import { BillingCycle } from '../subscription-plans/entities/subscription-plan.entity';
import { SubscriptionPlansService } from '../subscription-plans/subscription-plans.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto';

@Injectable()
export class VendorsService {
  constructor(
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
    @InjectRepository(VendorSubscription)
    private readonly subscriptionRepo: Repository<VendorSubscription>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly plansService: SubscriptionPlansService,
  ) {}

  async findAll() {
    const vendors = await this.vendorRepo.find({
      relations: ['subscriptions', 'subscriptions.plan', 'onboarded_by', 'referred_by'],
      order: { created_at: 'DESC' },
    });

    return vendors.map((v) => {
      const activeSub = v.subscriptions?.find((s) => s.status === SubscriptionStatus.ACTIVE) ?? null;
      return {
        public_id: v.public_id,
        name: v.name,
        subdomain: v.subdomain,
        email: v.email,
        phone: v.phone,
        status: v.status,
        onboarding_source: v.onboarding_source,
        onboarded_by: v.onboarded_by ? { name: v.onboarded_by.name } : null,
        referred_by: v.referred_by ? { name: v.referred_by.name } : null,
        created_at: v.created_at,
        subscription: activeSub
          ? {
              status: activeSub.status,
              is_trial: activeSub.is_trial,
              plan: activeSub.plan ? { name: activeSub.plan.name, plan_type: activeSub.plan.plan_type } : null,
              expires_at: activeSub.end_date,
            }
          : null,
      };
    });
  }

  private readonly vendorDetailRelations = ['subscriptions', 'subscriptions.plan', 'onboarded_by', 'referred_by'];
  // start_date is DATE-precision, so a same-day activation (the common case —
  // trial + immediate upgrade) ties with the trial's start_date. created_at
  // (full timestamp) breaks the tie so the current/active subscription —
  // always the most recently created on a tie — wins.
  private readonly vendorDetailOrder = { subscriptions: { start_date: 'DESC' as const, created_at: 'DESC' as const } };

  private mapVendorDetail(vendor: Vendor) {
    return {
      public_id: vendor.public_id,
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
      status: vendor.status,
      onboarding_source: vendor.onboarding_source,
      onboarded_by: vendor.onboarded_by ? { name: vendor.onboarded_by.name } : null,
      referred_by: vendor.referred_by ? { name: vendor.referred_by.name } : null,
      created_at: vendor.created_at,
      updated_at: vendor.updated_at,
      // Sorted newest-activation-first by the query's `order` above; the
      // per-subscription shape here also hides internal PKs (plan_id,
      // vendor_id, id_vendor_subscription) the same way findAll() does.
      subscriptions: vendor.subscriptions.map((s) => ({
        status: s.status,
        is_trial: s.is_trial,
        start_date: s.start_date,
        end_date: s.end_date,
        plan: s.plan
          ? {
              public_id: s.plan.public_id,
              name: s.plan.name,
              plan_type: s.plan.plan_type,
              billing_cycle: s.plan.billing_cycle,
              monthly_fee: s.plan.monthly_fee,
            }
          : null,
      })),
    };
  }

  async findOne(publicId: string) {
    const vendor = await this.vendorRepo.findOne({
      where: { public_id: publicId },
      relations: this.vendorDetailRelations,
      order: this.vendorDetailOrder,
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return this.mapVendorDetail(vendor);
  }

  async findOneByVendorId(vendorId: number) {
    const vendor = await this.vendorRepo.findOne({
      where: { id_vendor: vendorId },
      relations: this.vendorDetailRelations,
      order: this.vendorDetailOrder,
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return this.mapVendorDetail(vendor);
  }

  private async getVendorOrFail(publicId: string): Promise<Vendor> {
    const vendor = await this.vendorRepo.findOneBy({ public_id: publicId });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  private async checkDuplicates(dto: CreateVendorDto, excludePublicId?: string) {
    const checks: { field: string; value: string | undefined }[] = [
      { field: 'email', value: dto.email },
      { field: 'phone', value: dto.phone },
      { field: 'subdomain', value: dto.subdomain },
      { field: 'business_reg_no', value: dto.business_reg_no },
    ];

    for (const { field, value } of checks) {
      if (!value) continue;
      const existing = await this.vendorRepo.findOneBy({ [field]: value } as any);
      if (existing && existing.public_id !== excludePublicId) {
        throw new ConflictException(`A vendor with this ${field} already exists`);
      }
    }
  }

  private validateReferralSource(source: OnboardingSource, referredByVendorPublicId?: string) {
    if (source === OnboardingSource.REFERRAL && !referredByVendorPublicId) {
      throw new BadRequestException(
        'referred_by_vendor_public_id is required when onboarding_source is REFERRAL',
      );
    }
    if (source !== OnboardingSource.REFERRAL && referredByVendorPublicId) {
      throw new BadRequestException(
        'referred_by_vendor_public_id can only be set when onboarding_source is REFERRAL',
      );
    }
  }

  // An unresolvable referral is not fatal — fall back to no referrer rather
  // than rejecting the whole request over a stale/bad referral link.
  private async resolveReferrerId(referredByVendorPublicId?: string): Promise<number | null> {
    if (!referredByVendorPublicId) return null;
    const referrer = await this.vendorRepo.findOneBy({ public_id: referredByVendorPublicId });
    return referrer?.id_vendor ?? null;
  }

  async create(dto: CreateVendorDto, onboardedByUserId: number) {
    const source = dto.onboarding_source ?? OnboardingSource.SUPER_ADMIN;
    this.validateReferralSource(source, dto.referred_by_vendor_public_id);

    const referredByVendorId = await this.resolveReferrerId(dto.referred_by_vendor_public_id);

    const existingOwner = await this.userRepo.findOneBy({ email: dto.owner_email });
    if (existingOwner) throw new ConflictException('A user with this owner_email already exists');

    await this.checkDuplicates(dto);
    const vendor = this.vendorRepo.create({
      name: dto.name,
      subdomain: dto.subdomain,
      email: dto.email,
      phone: dto.phone,
      address: dto.address,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      pincode: dto.pincode,
      business_reg_no: dto.business_reg_no,
      business_type: dto.business_type,
      status: VendorStatus.TRIAL,
      onboarding_source: source,
      onboarded_by_user_id: source === OnboardingSource.SUPER_ADMIN ? onboardedByUserId : null,
      referred_by_vendor_id: referredByVendorId,
    });

    const saved = await this.vendorRepo.save(vendor);

    const defaultPlan = await this.plansService.findDefaultTrialPlan();
    if (!defaultPlan) {
      throw new BadRequestException('No active default trial plan is configured. Contact system administrator.');
    }

    const today = new Date();
    const trialEnd = new Date(today);
    trialEnd.setDate(trialEnd.getDate() + 30);

    await this.subscriptionRepo.save(
      this.subscriptionRepo.create({
        vendor_id: saved.id_vendor,
        plan_id: defaultPlan.id_subscription_plan,
        is_trial: true,
        status: SubscriptionStatus.ACTIVE,
        start_date: today,
        end_date: trialEnd,
      }),
    );

    await this.userRepo.save(
      this.userRepo.create({
        name: dto.owner_name,
        email: dto.owner_email,
        password_hash: await bcrypt.hash(dto.owner_password, 10),
        role: Role.VENDOR_OWNER,
        vendor_id: saved.id_vendor,
        is_active: true,
      }),
    );

    return this.findOne(saved.public_id);
  }

  async update(publicId: string, dto: UpdateVendorDto) {
    const vendor = await this.getVendorOrFail(publicId);

    const existing = await this.vendorRepo.findOneBy({ subdomain: dto.subdomain });
    if (existing && existing.public_id !== publicId) {
      throw new ConflictException('A vendor with this subdomain already exists');
    }

    const existingReg = await this.vendorRepo.findOneBy({ business_reg_no: dto.business_reg_no });
    if (existingReg && existingReg.public_id !== publicId) {
      throw new ConflictException('A vendor with this business_reg_no already exists');
    }

    await this.vendorRepo.update(vendor.id_vendor, {
      name: dto.name,
      subdomain: dto.subdomain,
      address: dto.address,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      pincode: dto.pincode,
      business_reg_no: dto.business_reg_no,
      business_type: dto.business_type,
    });

    return this.findOne(publicId);
  }

  async updateProfile(vendorId: number, dto: UpdateVendorProfileDto) {
    const vendor = await this.vendorRepo.findOneBy({ id_vendor: vendorId });
    if (!vendor) throw new NotFoundException('Vendor not found');

    await this.vendorRepo.update(vendorId, {
      name: dto.name,
      address: dto.address,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      pincode: dto.pincode,
      business_type: dto.business_type,
    });

    return this.findOneByVendorId(vendorId);
  }

  async activateVendor(publicId: string, planPublicId: string) {
    const vendor = await this.getVendorOrFail(publicId);
    const plan = await this.plansService.findRaw(planPublicId);
    if (plan.is_deleted) throw new BadRequestException('Cannot activate a vendor onto a deleted plan');
    if (!plan.is_active) throw new BadRequestException('Cannot activate a vendor onto a deactivated plan');

    await this.subscriptionRepo.update(
      { vendor_id: vendor.id_vendor, status: SubscriptionStatus.ACTIVE },
      { status: SubscriptionStatus.EXPIRED },
    );

    const today = new Date();
    const endDate = new Date(today);
    if (plan.billing_cycle === BillingCycle.MONTHLY) {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    await this.subscriptionRepo.save(
      this.subscriptionRepo.create({
        vendor_id: vendor.id_vendor,
        plan_id: plan.id_subscription_plan,
        is_trial: false,
        status: SubscriptionStatus.ACTIVE,
        start_date: today,
        end_date: endDate,
      }),
    );

    await this.vendorRepo.update(vendor.id_vendor, { status: VendorStatus.ACTIVE });
    return this.findOne(publicId);
  }
}
