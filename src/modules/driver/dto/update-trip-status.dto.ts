import { IsEnum, IsNotEmpty } from 'class-validator';
import { RideStatus } from '@prisma/client';

export class UpdateTripStatusDto {
  @IsEnum(RideStatus)
  @IsNotEmpty()
  status: RideStatus;
}
