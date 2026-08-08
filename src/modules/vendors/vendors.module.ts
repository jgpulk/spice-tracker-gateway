import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';
import { Vendor } from './entities/vendor.entity';
import { VendorSubscription } from './entities/vendor-subscription.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Vendor, VendorSubscription])],
  controllers: [VendorsController],
  providers: [VendorsService],
  exports: [VendorsService],
})
export class VendorsModule {}
