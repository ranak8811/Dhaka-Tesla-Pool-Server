import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class QuoteRequestDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  pickupZone?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  destinationZone?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  distanceKm?: number;
}
