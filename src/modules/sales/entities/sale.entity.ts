import { randomUUID } from 'crypto';
import { Exclude } from 'class-transformer';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SaleType } from '../../../common/enums/sale-type.enum';
import { Vendor } from '../../vendors/entities/vendor.entity';
import { Client } from '../../clients/entities/client.entity';
import { SaleBatch } from './sale-batch.entity';
import { SaleStockItem } from './sale-stock-item.entity';

@Entity('sales')
export class Sale {
  @Exclude()
  @PrimaryGeneratedColumn()
  id_sale: number;

  @Column({ type: 'varchar', length: 36, unique: true })
  public_id: string;

  @Column()
  vendor_id: number;

  @Column()
  client_id: number;

  @Column({ type: 'enum', enum: SaleType })
  sale_type: SaleType;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  total_weight_kg: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total_amount: number;

  @CreateDateColumn()
  sold_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @BeforeInsert()
  setPublicId() {
    this.public_id = randomUUID();
  }

  @ManyToOne(() => Vendor, (vendor) => vendor.sales)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @ManyToOne(() => Client, (client) => client.sales)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @OneToMany(() => SaleBatch, (sb) => sb.sale, { cascade: true })
  sale_batches: SaleBatch[];

  @OneToMany(() => SaleStockItem, (item) => item.sale, { cascade: true })
  sale_stock_items: SaleStockItem[];
}
