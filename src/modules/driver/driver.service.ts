import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PoolStatus } from '@prisma/client';
import { ToggleStatusDto } from './dto/toggle-status.dto.js';

@Injectable()
export class DriverService {
  constructor(private readonly prisma: PrismaService) {}

  async toggleStatus(driverId: string, dto: ToggleStatusDto) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { driverId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found for this driver');
    }

    const targetOnlineStatus =
      dto.isOnline !== undefined ? dto.isOnline : !vehicle.isOnline;

    if (!targetOnlineStatus) {
      const activePool = await this.prisma.pool.findFirst({
        where: {
          vehicleId: vehicle.id,
          status: { in: [PoolStatus.OPEN, PoolStatus.FULL, PoolStatus.IN_TRANSIT] },
        },
      });

      if (activePool) {
        throw new BadRequestException('Finish trip before going offline');
      }
    }

    const updatedVehicle = await this.prisma.vehicle.update({
      where: { id: vehicle.id },
      data: {
        isOnline: targetOnlineStatus,
        ...(dto.currentZone ? { currentZone: dto.currentZone } : {}),
      },
    });

    return {
      isOnline: updatedVehicle.isOnline,
      vehicle: updatedVehicle.name,
      currentZone: updatedVehicle.currentZone,
    };
  }

  async getActivePool(driverId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { driverId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found for this driver');
    }

    const pool = await this.prisma.pool.findFirst({
      where: {
        vehicleId: vehicle.id,
        status: { in: [PoolStatus.OPEN, PoolStatus.FULL, PoolStatus.IN_TRANSIT] },
      },
      include: {
        rideRequests: {
          where: { status: { not: 'CANCELLED' } },
          include: { passenger: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!pool) {
      return null;
    }

    return {
      poolId: pool.id,
      vehicleName: vehicle.name,
      occupiedSeats: pool.occupiedSeats,
      maxCapacity: vehicle.maxCapacity,
      status: pool.status,
      passengers: pool.rideRequests.map((ride) => ({
        rideId: ride.id,
        name: ride.passenger.name,
        pickup: ride.pickupZone,
        drop: ride.destinationZone,
        destination: ride.destinationZone,
        seats: ride.seatsRequested,
        status: ride.status,
        fareBdt: Number((ride.totalFarePoysha / 100).toFixed(2)),
      })),
    };
  }
}
