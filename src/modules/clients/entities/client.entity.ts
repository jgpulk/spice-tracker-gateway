import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ClientType } from '../../../common/enums/client-type.enum';
import { Sale } from '../../sales/entities/sale.entity';
import { Vendor } from '../../vendors/entities/vendor.entity';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn()
  id_client: number;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 50 })
  phone: string;

  @Column({ length: 255, nullable: true })
  email: string;

  @Column({ length: 255, nullable: true })
  company_name: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'enum', enum: ClientType, default: ClientType.INDIVIDUAL })
  type: ClientType;

  @Column({ nullable: true })
  ref_vendor_id: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Vendor, { nullable: true })
  @JoinColumn({ name: 'ref_vendor_id' })
  ref_vendor: Vendor;

  @OneToMany(() => Sale, (sale) => sale.client)
  sales: Sale[];
}
