import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vendor, VendorStatus } from '../vendors/entities/vendor.entity';
import { SubscriptionStatus, VendorSubscription } from '../vendors/entities/vendor-subscription.entity';

/** How far ahead the "expiring soon" buckets look. */
const EXPIRY_WINDOW_DAYS = 7;
/** Number of months included in the signup trend, inclusive of the current month. */
const SIGNUP_TREND_MONTHS = 12;

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
  ) {}

  /**
   * Platform-wide stats for the Super Admin dashboard.
   *
   * Loads every vendor with its subscriptions once and aggregates in memory.
   * That is deliberate: vendors are tenants (hundreds, not millions), and it
   * keeps this consistent with the repository-based style used elsewhere in the
   * codebase. If the tenant count ever grows large enough to matter, move the
   * counts and the MRR sum into SQL aggregates instead.
   */
  async getSuperAdminStats() {
    const vendors = await this.vendorRepo.find({
      relations: ['subscriptions', 'subscriptions.plan'],
      order: { created_at: 'DESC' },
    });

    const rows = vendors.map((vendor) => ({
      vendor,
      activeSub: this.activeSubscription(vendor),
    }));

    return {
      vendors: this.buildVendorCounts(vendors),
      subscriptions: this.buildSubscriptionCounts(rows),
      revenue: this.buildRevenue(rows),
      plan_distribution: this.buildPlanDistribution(rows),
      signups_by_month: this.buildSignupTrend(vendors),
      attention: this.buildAttention(rows),
      generated_at: new Date(),
    };
  }

  // ---------- helpers ----------

  private activeSubscription(vendor: Vendor): VendorSubscription | null {
    return vendor.subscriptions?.find((s) => s.status === SubscriptionStatus.ACTIVE) ?? null;
  }

  /**
   * `date` columns come back from the MySQL driver as 'YYYY-MM-DD' strings even
   * though the entity types them as Date, so accept both and normalise to local
   * midnight for whole-day comparisons.
   */
  private toDateOnly(value: Date | string | null): Date | null {
    if (!value) return null;
    const parsed =
      value instanceof Date ? new Date(value) : new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }

  private daysUntil(value: Date | string | null): number | null {
    const target = this.toDateOnly(value);
    if (!target) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / 86_400_000);
  }

  private isWithinExpiryWindow(value: Date | string | null): boolean {
    const days = this.daysUntil(value);
    return days !== null && days >= 0 && days <= EXPIRY_WINDOW_DAYS;
  }

  private monthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  // ---------- sections ----------

  private buildVendorCounts(vendors: Vendor[]) {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const createdAt = (v: Vendor) => new Date(v.created_at);

    return {
      total: vendors.length,
      active: vendors.filter((v) => v.status === VendorStatus.ACTIVE).length,
      trial: vendors.filter((v) => v.status === VendorStatus.TRIAL).length,
      suspended: vendors.filter((v) => v.status === VendorStatus.SUSPENDED).length,
      new_this_month: vendors.filter((v) => createdAt(v) >= thisMonthStart).length,
      new_last_month: vendors.filter(
        (v) => createdAt(v) >= lastMonthStart && createdAt(v) < thisMonthStart,
      ).length,
    };
  }

  private buildSubscriptionCounts(rows: { vendor: Vendor; activeSub: VendorSubscription | null }[]) {
    const withActive = rows.filter((r) => r.activeSub);

    return {
      active: withActive.length,
      trial: withActive.filter((r) => r.activeSub!.is_trial).length,
      paid: withActive.filter((r) => !r.activeSub!.is_trial).length,
      expiring_within_7_days: withActive.filter(
        (r) => !r.activeSub!.is_trial && this.isWithinExpiryWindow(r.activeSub!.end_date),
      ).length,
      trials_ending_within_7_days: withActive.filter(
        (r) => r.activeSub!.is_trial && this.isWithinExpiryWindow(r.activeSub!.end_date),
      ).length,
      vendors_without_active_subscription: rows.filter((r) => !r.activeSub).length,
    };
  }

  /**
   * `monthly_fee` is already a per-month figure on both MONTHLY and ANNUAL plans
   * (an annual plan simply carries a lower monthly rate), so MRR is a straight
   * sum across paid active subscriptions. Trials contribute nothing.
   *
   * Note this reflects *subscribed* value, not collected cash — the system has
   * no payment records, so nothing here proves a vendor actually paid.
   */
  private buildRevenue(rows: { vendor: Vendor; activeSub: VendorSubscription | null }[]) {
    const mrr = rows.reduce((sum, r) => {
      const sub = r.activeSub;
      if (!sub || sub.is_trial || !sub.plan) return sum;
      const fee = Number(sub.plan.monthly_fee);
      return Number.isFinite(fee) ? sum + fee : sum;
    }, 0);

    const rounded = Math.round(mrr * 100) / 100;

    return {
      currency: 'INR',
      mrr: rounded,
      arr: Math.round(rounded * 12 * 100) / 100,
    };
  }

  private buildPlanDistribution(rows: { vendor: Vendor; activeSub: VendorSubscription | null }[]) {
    const buckets = new Map<
      string,
      {
        plan_id: string;
        name: string;
        plan_type: string;
        billing_cycle: string;
        monthly_fee: number;
        vendors: number;
      }
    >();

    for (const { activeSub } of rows) {
      const plan = activeSub?.plan;
      if (!plan) continue;

      const existing = buckets.get(plan.public_id);
      if (existing) {
        existing.vendors += 1;
        continue;
      }

      buckets.set(plan.public_id, {
        plan_id: plan.public_id,
        name: plan.name,
        plan_type: plan.plan_type,
        billing_cycle: plan.billing_cycle,
        monthly_fee: Number(plan.monthly_fee),
        vendors: 1,
      });
    }

    return [...buckets.values()].sort((a, b) => b.vendors - a.vendors || a.name.localeCompare(b.name));
  }

  private buildSignupTrend(vendors: Vendor[]) {
    const counts = new Map<string, number>();
    const now = new Date();

    // Seed the whole window so months with no signups still appear as zero.
    for (let i = SIGNUP_TREND_MONTHS - 1; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      counts.set(this.monthKey(month), 0);
    }

    for (const vendor of vendors) {
      const key = this.monthKey(new Date(vendor.created_at));
      if (counts.has(key)) {
        counts.set(key, counts.get(key)! + 1);
      }
    }

    return [...counts.entries()].map(([month, count]) => ({ month, count }));
  }

  private buildAttention(rows: { vendor: Vendor; activeSub: VendorSubscription | null }[]) {
    const expiring = (trial: boolean) =>
      rows
        .filter(
          (r) =>
            r.activeSub &&
            r.activeSub.is_trial === trial &&
            this.isWithinExpiryWindow(r.activeSub.end_date),
        )
        .map((r) => ({
          vendor_id: r.vendor.public_id,
          name: r.vendor.name,
          plan_name: r.activeSub!.plan?.name ?? null,
          expires_at: r.activeSub!.end_date,
          days_remaining: this.daysUntil(r.activeSub!.end_date),
        }))
        .sort((a, b) => (a.days_remaining ?? 0) - (b.days_remaining ?? 0));

    return {
      expiring_soon: expiring(false),
      trials_ending_soon: expiring(true),
      suspended: rows
        .filter((r) => r.vendor.status === VendorStatus.SUSPENDED)
        .map((r) => ({
          vendor_id: r.vendor.public_id,
          name: r.vendor.name,
          status: r.vendor.status,
        })),
      // Not suspended yet somehow has no ACTIVE subscription row — a data
      // anomaly worth surfacing rather than silently ignoring.
      missing_subscription: rows
        .filter((r) => !r.activeSub && r.vendor.status !== VendorStatus.SUSPENDED)
        .map((r) => ({
          vendor_id: r.vendor.public_id,
          name: r.vendor.name,
          status: r.vendor.status,
        })),
    };
  }
}
