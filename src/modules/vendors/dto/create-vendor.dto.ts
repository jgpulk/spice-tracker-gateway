import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength } from 'class-validator';
import { VendorStatus } from '../entities/vendor.entity';

export class CreateVendorDto {
  @ApiProperty({ example: 'Green Cardamom Shop' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'green-cardamom' })
  @IsString()
  @MaxLength(100)
  subdomain: string;

  @ApiProperty({ enum: VendorStatus, default: VendorStatus.TRIAL })
  @IsEnum(VendorStatus)
  status: VendorStatus;
}
