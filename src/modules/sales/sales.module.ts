import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { Sale } from './entities/sale.entity';
import { SaleBatch } from './entities/sale-batch.entity';
import { SaleStockItem } from './entities/sale-stock-item.entity';
import { StockBatch } from '../stock-batches/entities/stock-batch.entity';
import { GradedStock } from '../graded-stock/entities/graded-stock.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Sale, SaleBatch, SaleStockItem, StockBatch, GradedStock])],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
