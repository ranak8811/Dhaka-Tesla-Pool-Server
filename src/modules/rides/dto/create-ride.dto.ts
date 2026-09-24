import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateRideDto {
  @IsString()
  @IsNotEmpty()
  pickupZone: string;

  @IsString()
  @IsNotEmpty()
  destinationZone: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  seatsRequested?: number = 1;
}
