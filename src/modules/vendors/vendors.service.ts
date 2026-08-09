import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as bcrypt from 'bcrypt';
import { Vendor, OnboardingSource, VendorStatus } from './entities/vendor.entity';
import { SubscriptionStatus, VendorSubscription } from './entities/vendor-subscription.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../../common/enums/role.enum';
import { SubscriptionPlansService } from '../subscription-plans/subscription-plans.service';
import { CreateVendorDto } from './dto/create-vendor.dto';

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

  findAll() {
    return this.vendorRepo.find({
      relations: ['subscriptions', 'subscriptions.plan'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(publicId: string) {
    const vendor = await this.vendorRepo.findOne({
      where: { public_id: publicId },
      relations: ['subscriptions', 'subscriptions.plan'],
    });
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
      country: dto.country ?? 'India',
      pincode: dto.pincode,
      business_reg_no: dto.business_reg_no,
      business_type: dto.business_type,
      status: VendorStatus.TRIAL,
      onboarding_source: source,
      onboarded_by_user_id: source === OnboardingSource.SUPER_ADMIN ? onboardedByUserId : null,
      referred_by_vendor_id: referredByVendorId,
    });

    const saved = await this.vendorRepo.save(vendor);

    const today = new Date();
    const trialEnd = new Date(today);
    trialEnd.setDate(trialEnd.getDate() + 30);

    await this.subscriptionRepo.save(
      this.subscriptionRepo.create({
        vendor_id: saved.id_vendor,
        plan_id: null,
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

  async update(publicId: string, dto: CreateVendorDto) {
    const vendor = await this.findOne(publicId);
    const source = dto.onboarding_source ?? vendor.onboarding_source;
    this.validateReferralSource(source, dto.referred_by_vendor_public_id);

    const referredByVendorId =
      source === OnboardingSource.REFERRAL
        ? await this.resolveReferrerId(dto.referred_by_vendor_public_id)
        : null;

    await this.checkDuplicates(dto, publicId);

    await this.vendorRepo.update(vendor.id_vendor, {
      name: dto.name,
      subdomain: dto.subdomain,
      email: dto.email,
      phone: dto.phone,
      address: dto.address,
      city: dto.city,
      state: dto.state,
      country: dto.country ?? 'India',
      pincode: dto.pincode,
      business_reg_no: dto.business_reg_no,
      business_type: dto.business_type,
      onboarding_source: source,
      referred_by_vendor_id: referredByVendorId,
    });

    return this.findOne(publicId);
  }

  async activateVendor(publicId: string, planPublicId: string) {
    const vendor = await this.findOne(publicId);
    const plan = await this.plansService.findOne(planPublicId);

    await this.subscriptionRepo.update(
      { vendor_id: vendor.id_vendor, status: SubscriptionStatus.ACTIVE },
      { status: SubscriptionStatus.EXPIRED },
    );

    const today = new Date();
    await this.subscriptionRepo.save(
      this.subscriptionRepo.create({
        vendor_id: vendor.id_vendor,
        plan_id: plan.id_subscription_plan,
        is_trial: false,
        status: SubscriptionStatus.ACTIVE,
        start_date: today,
        end_date: null,
      }),
    );

    await this.vendorRepo.update(vendor.id_vendor, { status: VendorStatus.ACTIVE });
    return this.findOne(publicId);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireTrials() {
    const today = new Date();

    const expiredSubs = await this.subscriptionRepo.find({
      where: { end_date: LessThan(today), status: SubscriptionStatus.ACTIVE },
      relations: ['vendor'],
    });

    const trialVendorIds = expiredSubs
      .filter((sub) => sub.vendor?.status === VendorStatus.TRIAL)
      .map((sub) => sub.vendor_id);

    if (trialVendorIds.length === 0) return;

    for (const vendorId of trialVendorIds) {
      await this.subscriptionRepo.update(
        { vendor_id: vendorId, status: SubscriptionStatus.ACTIVE },
        { status: SubscriptionStatus.EXPIRED },
      );
      await this.vendorRepo.update(vendorId, { status: VendorStatus.SUSPENDED });
    }

    console.log(`[TrialExpiry] Suspended ${trialVendorIds.length} vendor(s) with expired trials.`);
  }
}
