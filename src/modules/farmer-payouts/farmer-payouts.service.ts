import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FarmerPayout, PayoutStatus } from './entities/farmer-payout.entity';

@Injectable()
export class FarmerPayoutsService {
  constructor(
    @InjectRepository(FarmerPayout)
    private readonly payoutRepo: Repository<FarmerPayout>,
  ) {}

  findAllByVendor(vendor_id: number) {
    return this.payoutRepo.find({ where: { vendor_id }, relations: ['farmer', 'batch'] });
  }

  async markPaid(id: number, vendor_id: number) {
    const payout = await this.payoutRepo.findOneBy({ id_farmer_payout: id, vendor_id });
    if (!payout) throw new NotFoundException('Payout not found');
    await this.payoutRepo.update({ id_farmer_payout: id }, { status: PayoutStatus.PAID, paid_at: new Date() });
    return this.payoutRepo.findOneBy({ id_farmer_payout: id });
  }

  create(data: Partial<FarmerPayout>) {
    return this.payoutRepo.save(this.payoutRepo.create(data));
  }
}
