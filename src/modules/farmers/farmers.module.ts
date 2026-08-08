import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FarmersController } from './farmers.controller';
import { FarmersService } from './farmers.service';
import { Farmer } from './entities/farmer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Farmer])],
  controllers: [FarmersController],
  providers: [FarmersService],
  exports: [FarmersService],
})
export class FarmersModule {}
