import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreateRideDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  poolId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  pickupZone?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  destinationZone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  seatsRequested?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  seats?: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
