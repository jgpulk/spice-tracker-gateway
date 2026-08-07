import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GradedStockController } from './graded-stock.controller';
import { GradedStockService } from './graded-stock.service';
import { GradedStock } from './entities/graded-stock.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GradedStock])],
  controllers: [GradedStockController],
  providers: [GradedStockService],
  exports: [GradedStockService],
})
export class GradedStockModule {}
