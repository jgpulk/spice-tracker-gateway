import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';

@Injectable()
export class SubscriptionPlansService {
  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly planRepo: Repository<SubscriptionPlan>,
  ) {}

  findAll() {
    return this.planRepo.find({ order: { plan_type: 'ASC', monthly_fee: 'ASC' } });
  }

  async findOne(publicId: string) {
    const plan = await this.planRepo.findOneBy({ public_id: publicId });
    if (!plan) throw new NotFoundException('Subscription plan not found');
    return plan;
  }

  findDefaultTrialPlan() {
    return this.planRepo.findOneBy({ is_default_trial: true });
  }

  async create(dto: CreateSubscriptionPlanDto) {
    if (dto.is_default_trial) {
      await this.planRepo.update({ is_default_trial: true }, { is_default_trial: false });
    }
    const plan = this.planRepo.create({ ...dto, is_active: dto.is_active ?? true });
    return this.planRepo.save(plan);
  }

  async update(publicId: string, dto: Partial<CreateSubscriptionPlanDto>) {
    const plan = await this.findOne(publicId);
    if (dto.is_default_trial) {
      await this.planRepo.update({ is_default_trial: true }, { is_default_trial: false });
    }
    await this.planRepo.update(plan.id_subscription_plan, dto);
    return this.findOne(publicId);
  }
}
