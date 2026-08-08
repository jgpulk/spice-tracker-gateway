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

  async findOne(id: number) {
    const plan = await this.planRepo.findOneBy({ id_subscription_plan: id });
    if (!plan) throw new NotFoundException('Subscription plan not found');
    return plan;
  }

  create(dto: CreateSubscriptionPlanDto) {
    const plan = this.planRepo.create({ ...dto, is_active: dto.is_active ?? true });
    return this.planRepo.save(plan);
  }

  async update(id: number, dto: Partial<CreateSubscriptionPlanDto>) {
    await this.findOne(id);
    await this.planRepo.update(id, dto);
    return this.findOne(id);
  }
}
