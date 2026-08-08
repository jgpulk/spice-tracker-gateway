import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Vendor, OnboardingSource, VendorStatus } from './entities/vendor.entity';
import { SubscriptionStatus, VendorSubscription } from './entities/vendor-subscription.entity';
import { SubscriptionPlansService } from '../subscription-plans/subscription-plans.service';
import { CreateVendorDto } from './dto/create-vendor.dto';

@Injectable()
export class VendorsService {
  constructor(
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
    @InjectRepository(VendorSubscription)
    private readonly subscriptionRepo: Repository<VendorSubscription>,
    private readonly plansService: SubscriptionPlansService,
  ) {}

  findAll() {
    return this.vendorRepo.find({
      relations: ['subscriptions', 'subscriptions.plan'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: number) {
    const vendor = await this.vendorRepo.findOne({
      where: { id_vendor: id },
      relations: ['subscriptions', 'subscriptions.plan'],
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  private async checkDuplicates(dto: CreateVendorDto, excludeId?: number) {
    const checks: { field: string; value: string | undefined }[] = [
      { field: 'email', value: dto.email },
      { field: 'phone', value: dto.phone },
      { field: 'subdomain', value: dto.subdomain },
      { field: 'business_reg_no', value: dto.business_reg_no },
    ];

    for (const { field, value } of checks) {
      if (!value) continue;
      const existing = await this.vendorRepo.findOneBy({ [field]: value } as any);
      if (existing && existing.id_vendor !== excludeId) {
        throw new ConflictException(`A vendor with this ${field} already exists`);
      }
    }
  }

  async create(dto: CreateVendorDto, onboardedByUserId: number) {
    const source = dto.onboarding_source ?? OnboardingSource.SUPER_ADMIN;

    if (source === OnboardingSource.REFERRAL && !dto.referred_by_vendor_id) {
      throw new BadRequestException('referred_by_vendor_id is required when onboarding_source is REFERRAL');
    }
    if (source !== OnboardingSource.REFERRAL && dto.referred_by_vendor_id) {
      throw new BadRequestException('referred_by_vendor_id can only be set when onboarding_source is REFERRAL');
    }

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
      business_reg_no: dto.business_reg_no ?? null,
      business_type: dto.business_type ?? null,
      status: VendorStatus.TRIAL,
      onboarding_source: source,
      onboarded_by_user_id: source === OnboardingSource.SUPER_ADMIN ? onboardedByUserId : null,
      referred_by_vendor_id: dto.referred_by_vendor_id ?? null,
    });

    const saved = await this.vendorRepo.save(vendor);

    const today = new Date();
    const trialEnd = new Date(today);
    trialEnd.setDate(trialEnd.getDate() + 30);

    await this.subscriptionRepo.save(
      this.subscriptionRepo.create({
        vendor_id: saved.id_vendor,
        plan_id: null,
        status: SubscriptionStatus.ACTIVE,
        start_date: today,
        end_date: trialEnd,
      }),
    );

    return this.findOne(saved.id_vendor);
  }

  async update(id: number, data: Partial<Vendor>) {
    await this.findOne(id);
    await this.vendorRepo.update(id, data);
    return this.findOne(id);
  }

  async activateVendor(id: number, planId: number) {
    await this.findOne(id);
    await this.plansService.findOne(planId); // validates plan exists

    // Expire any currently active subscription
    await this.subscriptionRepo.update(
      { vendor_id: id, status: SubscriptionStatus.ACTIVE },
      { status: SubscriptionStatus.EXPIRED },
    );

    // Insert new paid subscription (no end_date = ongoing)
    const today = new Date();
    await this.subscriptionRepo.save(
      this.subscriptionRepo.create({
        vendor_id: id,
        plan_id: planId,
        status: SubscriptionStatus.ACTIVE,
        start_date: today,
        end_date: null,
      }),
    );

    await this.vendorRepo.update(id, { status: VendorStatus.ACTIVE });
    return this.findOne(id);
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
