import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FarmerPayoutsController } from './farmer-payouts.controller';
import { FarmerPayoutsService } from './farmer-payouts.service';
import { FarmerPayout } from './entities/farmer-payout.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FarmerPayout])],
  controllers: [FarmerPayoutsController],
  providers: [FarmerPayoutsService],
  exports: [FarmerPayoutsService],
})
export class FarmerPayoutsModule {}
