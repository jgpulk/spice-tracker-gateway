import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockBatchesController } from './stock-batches.controller';
import { StockBatchesService } from './stock-batches.service';
import { StockBatch } from './entities/stock-batch.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StockBatch])],
  controllers: [StockBatchesController],
  providers: [StockBatchesService],
  exports: [StockBatchesService],
})
export class StockBatchesModule {}
