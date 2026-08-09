import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CronService } from './cron.service';
import { Vendor } from '../vendors/entities/vendor.entity';
import { VendorSubscription } from '../vendors/entities/vendor-subscription.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Vendor, VendorSubscription])],
  providers: [CronService],
})
export class CronModule {}
