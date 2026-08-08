import { randomUUID } from 'crypto';
import { Exclude } from 'class-transformer';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../../../common/enums/role.enum';
import { Vendor } from '../../vendors/entities/vendor.entity';

@Entity('users')
export class User {
  @Exclude()
  @PrimaryGeneratedColumn()
  id_user: number;

  @Column({ type: 'varchar', length: 36, unique: true })
  public_id: string;

  @Column({ type: 'int', nullable: true })
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

  @BeforeInsert()
  setPublicId() {
    this.public_id = randomUUID();
  }

  @ManyToOne(() => Vendor, (vendor) => vendor.users, { nullable: true })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;
}
