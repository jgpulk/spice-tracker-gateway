import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockBatchesController } from './stock-batches.controller';
import { StockBatchesService } from './stock-batches.service';
import { StockBatch } from './entities/stock-batch.entity';
import { Farmer } from '../farmers/entities/farmer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StockBatch, Farmer])],
  controllers: [StockBatchesController],
  providers: [StockBatchesService],
  exports: [StockBatchesService],
})
export class StockBatchesModule {}
