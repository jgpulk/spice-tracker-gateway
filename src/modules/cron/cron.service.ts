import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Vendor, VendorStatus } from '../vendors/entities/vendor.entity';
import { SubscriptionStatus, VendorSubscription } from '../vendors/entities/vendor-subscription.entity';

@Injectable()
export class CronService {
  constructor(
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
    @InjectRepository(VendorSubscription)
    private readonly subscriptionRepo: Repository<VendorSubscription>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireSubscriptions() {
    const today = new Date();

    const expiredSubs = await this.subscriptionRepo.find({
      where: { end_date: LessThan(today), status: SubscriptionStatus.ACTIVE },
      relations: ['vendor'],
    });

    const vendorIds = expiredSubs
      .filter((sub) => sub.vendor?.status !== VendorStatus.SUSPENDED)
      .map((sub) => sub.vendor_id);

    if (vendorIds.length === 0) return;

    for (const vendorId of vendorIds) {
      await this.subscriptionRepo.update(
        { vendor_id: vendorId, status: SubscriptionStatus.ACTIVE },
        { status: SubscriptionStatus.EXPIRED },
      );
      await this.vendorRepo.update(vendorId, { status: VendorStatus.SUSPENDED });
    }

    console.log(
      `[SubscriptionExpiry] Suspended ${vendorIds.length} vendor(s) with expired subscriptions.`,
    );
  }
}
