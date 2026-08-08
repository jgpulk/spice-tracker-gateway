import { Column, CreateDateColumn, Entity, ManyToOne, JoinColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Exclude } from 'class-transformer';
import { Role } from '../../../common/enums/role.enum';
import { Vendor } from '../../vendors/entities/vendor.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id_user: number;

  @Column({ nullable: true })
  vendor_id: number | null;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 255, unique: true })
  email: string;

  @Exclude()
  @Column({ length: 255 })
  password_hash: string;

  @Column({ type: 'enum', enum: Role })
  role: Role;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Vendor, (vendor) => vendor.users, { nullable: true })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;
}
