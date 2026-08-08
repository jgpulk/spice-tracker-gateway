import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { AuthModule } from './modules/auth/auth.module';
import { VendorsModule } from './modules/vendors/vendors.module';
import { UsersModule } from './modules/users/users.module';
import { FarmersModule } from './modules/farmers/farmers.module';
import { ClientsModule } from './modules/clients/clients.module';
import { StockBatchesModule } from './modules/stock-batches/stock-batches.module';
import { DryingLotsModule } from './modules/drying-lots/drying-lots.module';
import { GradedStockModule } from './modules/graded-stock/graded-stock.module';
import { SalesModule } from './modules/sales/sales.module';
import { FarmerPayoutsModule } from './modules/farmer-payouts/farmer-payouts.module';
import { SubscriptionPlansModule } from './modules/subscription-plans/subscription-plans.module';

import { Vendor } from './modules/vendors/entities/vendor.entity';
import { VendorSubscription } from './modules/vendors/entities/vendor-subscription.entity';
import { SubscriptionPlan } from './modules/subscription-plans/entities/subscription-plan.entity';
import { User } from './modules/users/entities/user.entity';
import { Client } from './modules/clients/entities/client.entity';
import { Farmer } from './modules/farmers/entities/farmer.entity';
import { StockBatch } from './modules/stock-batches/entities/stock-batch.entity';
import { DryingLot } from './modules/drying-lots/entities/drying-lot.entity';
import { GradedStock } from './modules/graded-stock/entities/graded-stock.entity';
import { Sale } from './modules/sales/entities/sale.entity';
import { SaleBatch } from './modules/sales/entities/sale-batch.entity';
import { SaleStockItem } from './modules/sales/entities/sale-stock-item.entity';
import { FarmerPayout } from './modules/farmer-payouts/entities/farmer-payout.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 3306),
        database: config.get<string>('DB_NAME'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        entities: [
          Vendor, VendorSubscription, SubscriptionPlan,
          User, Client, Farmer,
          StockBatch, DryingLot, GradedStock,
          Sale, SaleBatch, SaleStockItem, FarmerPayout,
        ],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
    }),
    AuthModule,
    VendorsModule,
    UsersModule,
    FarmersModule,
    ClientsModule,
    StockBatchesModule,
    DryingLotsModule,
    GradedStockModule,
    SalesModule,
    FarmerPayoutsModule,
    SubscriptionPlansModule,
  ],
})
export class AppModule {}
