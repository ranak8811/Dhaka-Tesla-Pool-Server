import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DriverService } from './driver.service.js';
import { ToggleStatusDto } from './dto/toggle-status.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '@prisma/client';

@Controller('driver')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DRIVER)
export class DriverController {
  constructor(private readonly driverService: DriverService) {}

  @Post('toggle-status')
  @HttpCode(HttpStatus.OK)
  toggleStatus(
    @CurrentUser() user: { id: string },
    @Body() dto: ToggleStatusDto,
  ) {
    return this.driverService.toggleStatus(user.id, dto);
  }

  @Get('active-pool')
  getActivePool(@CurrentUser() user: { id: string }) {
    return this.driverService.getActivePool(user.id);
  }
}
