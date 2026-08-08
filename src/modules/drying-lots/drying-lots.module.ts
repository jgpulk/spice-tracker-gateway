import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DryingLotsController } from './drying-lots.controller';
import { DryingLotsService } from './drying-lots.service';
import { DryingLot } from './entities/drying-lot.entity';
import { StockBatch } from '../stock-batches/entities/stock-batch.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DryingLot, StockBatch])],
  controllers: [DryingLotsController],
  providers: [DryingLotsService],
  exports: [DryingLotsService],
})
export class DryingLotsModule {}
