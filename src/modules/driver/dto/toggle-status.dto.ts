import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ToggleStatusDto {
  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  currentZone?: string;
}
