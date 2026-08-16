import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';

@Injectable()
export class SubscriptionPlansService {
  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly planRepo: Repository<SubscriptionPlan>,
  ) {}

  async findAll() {
    const plans = await this.planRepo.find({
      where: { is_deleted: false },
      order: { plan_type: 'ASC', monthly_fee: 'ASC' },
    });

    return plans.map(({ public_id, name, plan_type, billing_cycle, monthly_fee, description, is_active, is_default_trial }) => ({
      plan_id: public_id,
      name,
      plan_type,
      billing_cycle,
      monthly_fee,
      description,
      is_active,
      is_default_trial,
    }));
  }

  async findOne(publicId: string) {
    const plan = await this.planRepo.findOneBy({ public_id: publicId, is_deleted: false });
    if (!plan) throw new NotFoundException('Subscription plan not found');
    return {
      plan_id: plan.public_id,
      name: plan.name,
      plan_type: plan.plan_type,
      billing_cycle: plan.billing_cycle,
      monthly_fee: plan.monthly_fee,
      description: plan.description,
      is_active: plan.is_active,
      is_default_trial: plan.is_default_trial,
    };
  }

  findDefaultTrialPlan() {
    return this.planRepo.findOneBy({ is_default_trial: true, is_active: true, is_deleted: false });
  }

  async findRaw(publicId: string) {
    const plan = await this.planRepo.findOneBy({ public_id: publicId, is_deleted: false });
    if (!plan) throw new NotFoundException('Subscription plan not found');
    return plan;
  }

  async create(dto: CreateSubscriptionPlanDto) {
    const plan = this.planRepo.create({
      ...dto,
      is_active: dto.is_active ?? true,
      is_default_trial: false,
      is_deleted: false,
    });
    await this.planRepo.save(plan);
  }

  async update(publicId: string, dto: UpdateSubscriptionPlanDto) {
    const plan = await this.planRepo.findOneBy({ public_id: publicId });
    if (!plan) throw new NotFoundException('Subscription plan not found');
    if (plan.is_deleted) throw new BadRequestException('Cannot update a deleted subscription plan');

    await this.planRepo.update(plan.id_subscription_plan, {
      name: dto.name,
      plan_type: dto.plan_type,
      description: dto.description,
      is_active: dto.is_active,
    });
  }

  async delete(publicId: string) {
    const plan = await this.planRepo.findOneBy({ public_id: publicId, is_deleted: false });
    if (!plan) throw new NotFoundException('Subscription plan not found');
    await this.planRepo.update(plan.id_subscription_plan, { is_deleted: true, is_active: false });
  }
}
