import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Vendor } from '../vendors/entities/vendor.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Vendor])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
