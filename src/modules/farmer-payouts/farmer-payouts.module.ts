import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FarmerPayoutsController } from './farmer-payouts.controller';
import { FarmerPayoutsService } from './farmer-payouts.service';
import { FarmerPayout } from './entities/farmer-payout.entity';
import { Farmer } from '../farmers/entities/farmer.entity';
import { StockBatch } from '../stock-batches/entities/stock-batch.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FarmerPayout, Farmer, StockBatch])],
  controllers: [FarmerPayoutsController],
  providers: [FarmerPayoutsService],
  exports: [FarmerPayoutsService],
})
export class FarmerPayoutsModule {}
