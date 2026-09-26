import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PaymentMethod, PaymentStatus, PoolStatus, RideStatus } from '@prisma/client';
import { ToggleStatusDto } from './dto/toggle-status.dto.js';

export const VALID_RIDE_TRANSITIONS: Record<RideStatus, RideStatus[]> = {
  [RideStatus.REQUESTED]: [RideStatus.MATCHED, RideStatus.CANCELLED],
  [RideStatus.MATCHED]: [RideStatus.DRIVER_ARRIVED, RideStatus.CANCELLED],
  [RideStatus.DRIVER_ARRIVED]: [RideStatus.STARTED, RideStatus.CANCELLED],
  [RideStatus.STARTED]: [RideStatus.COMPLETED],
  [RideStatus.COMPLETED]: [],
  [RideStatus.CANCELLED]: [],
};

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
          where: { status: { not: RideStatus.CANCELLED } },
          include: { passenger: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!pool) {
      return null;
    }

    const pendingRequests = pool.rideRequests
      .filter((r) => r.status === RideStatus.REQUESTED)
      .map((ride) => ({
        rideId: ride.id,
        name: ride.passenger.name,
        pickup: ride.pickupZone,
        drop: ride.destinationZone,
        destination: ride.destinationZone,
        seats: ride.seatsRequested,
        status: ride.status,
        paymentMethod: ride.paymentMethod,
        fareBdt: Number((ride.totalFarePoysha / 100).toFixed(2)),
        createdAt: ride.createdAt,
      }));

    const confirmedPassengers = pool.rideRequests
      .filter((r) => r.status !== RideStatus.REQUESTED && r.status !== RideStatus.CANCELLED)
      .map((ride) => ({
        rideId: ride.id,
        name: ride.passenger.name,
        pickup: ride.pickupZone,
        drop: ride.destinationZone,
        destination: ride.destinationZone,
        seats: ride.seatsRequested,
        status: ride.status,
        paymentMethod: ride.paymentMethod,
        fareBdt: Number((ride.totalFarePoysha / 100).toFixed(2)),
      }));

    return {
      poolId: pool.id,
      vehicleName: vehicle.name,
      occupiedSeats: pool.occupiedSeats,
      maxCapacity: vehicle.maxCapacity,
      status: pool.status,
      passengers: confirmedPassengers,
      pendingRequests,
    };
  }

  async acceptRide(driverId: string, rideId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { driverId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found for this driver');
    }

    const ride = await this.prisma.rideRequest.findUnique({
      where: { id: rideId },
      include: { pool: true, passenger: true },
    });

    if (!ride) {
      throw new NotFoundException(`Ride with id ${rideId} not found`);
    }

    if (!ride.pool || ride.pool.vehicleId !== vehicle.id) {
      throw new ForbiddenException('You can only accept ride requests assigned to your vehicle');
    }

    if (ride.status !== RideStatus.REQUESTED) {
      throw new BadRequestException(
        `Cannot accept ride with status ${ride.status}. Must be REQUESTED.`,
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      const updatedRide = await tx.rideRequest.update({
        where: { id: rideId },
        data: { status: RideStatus.MATCHED },
        include: {
          passenger: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await tx.rideStatusLog.create({
        data: {
          rideId,
          previousStatus: RideStatus.REQUESTED,
          newStatus: RideStatus.MATCHED,
          changedBy: driverId,
        },
      });

      return {
        rideId: updatedRide.id,
        status: updatedRide.status,
        passengerName: updatedRide.passenger.name,
        message: 'Ride request accepted successfully.',
      };
    });
  }

  async rejectRide(driverId: string, rideId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { driverId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found for this driver');
    }

    const ride = await this.prisma.rideRequest.findUnique({
      where: { id: rideId },
      include: {
        pool: {
          include: {
            rideRequests: true,
          },
        },
      },
    });

    if (!ride) {
      throw new NotFoundException(`Ride with id ${rideId} not found`);
    }

    if (!ride.pool || ride.pool.vehicleId !== vehicle.id) {
      throw new ForbiddenException('You can only decline ride requests assigned to your vehicle');
    }

    if (ride.status !== RideStatus.REQUESTED) {
      throw new BadRequestException(
        `Cannot decline ride with status ${ride.status}. Must be REQUESTED.`,
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      const updatedRide = await tx.rideRequest.update({
        where: { id: rideId },
        data: { status: RideStatus.CANCELLED },
      });

      await tx.rideStatusLog.create({
        data: {
          rideId,
          previousStatus: RideStatus.REQUESTED,
          newStatus: RideStatus.CANCELLED,
          changedBy: driverId,
        },
      });

      const remainingSeats = Math.max(0, ride.pool!.occupiedSeats - ride.seatsRequested);
      const remainingActiveRides = ride.pool!.rideRequests.filter(
        (r) => r.id !== rideId && r.status !== RideStatus.CANCELLED,
      );

      const newPoolStatus =
        remainingActiveRides.length === 0
          ? PoolStatus.CANCELLED
          : (ride.pool!.status === PoolStatus.FULL && remainingSeats < 3
              ? PoolStatus.OPEN
              : ride.pool!.status);

      await tx.pool.update({
        where: { id: ride.pool!.id },
        data: {
          occupiedSeats: remainingSeats,
          status: newPoolStatus,
        },
      });

      return {
        rideId: updatedRide.id,
        status: updatedRide.status,
        message: 'Ride request declined and seat released.',
      };
    });
  }

  async updatePoolStatus(
    driverId: string,
    poolId: string,
    targetStatus: RideStatus,
  ) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { driverId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found for this driver');
    }

    const pool = await this.prisma.pool.findUnique({
      where: { id: poolId },
      include: {
        rideRequests: {
          where: { status: { not: RideStatus.CANCELLED } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!pool) {
      throw new NotFoundException(`Pool with id ${poolId} not found`);
    }

    if (pool.vehicleId !== vehicle.id) {
      throw new ForbiddenException('You can only update trips for your own vehicle');
    }

    const activeRides = pool.rideRequests.filter(
      (r) => r.status !== RideStatus.REQUESTED && r.status !== RideStatus.CANCELLED,
    );

    if (activeRides.length === 0) {
      throw new BadRequestException('No accepted active rides in this pool');
    }

    for (const ride of activeRides) {
      const allowedTargets = VALID_RIDE_TRANSITIONS[ride.status] || [];
      if (!allowedTargets.includes(targetStatus)) {
        throw new BadRequestException(
          `Illegal state transition from ${ride.status} to ${targetStatus}`,
        );
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      let newPoolStatus = pool.status;
      if (targetStatus === RideStatus.STARTED) {
        newPoolStatus = PoolStatus.IN_TRANSIT;
      } else if (targetStatus === RideStatus.COMPLETED) {
        newPoolStatus = PoolStatus.COMPLETED;
      }

      const updatedPool = await tx.pool.update({
        where: { id: poolId },
        data: { status: newPoolStatus },
      });

      const activeRideIds = activeRides.map((r) => r.id);

      await tx.rideRequest.updateMany({
        where: { id: { in: activeRideIds } },
        data: {
          status: targetStatus,
          ...(targetStatus === RideStatus.COMPLETED
            ? { paymentStatus: PaymentStatus.PAID }
            : {}),
        },
      });

      if (targetStatus === RideStatus.COMPLETED) {
        for (const ride of activeRides) {
          if (ride.paymentMethod === PaymentMethod.TESLAPAY) {
            await tx.user.update({
              where: { id: ride.passengerId },
              data: {
                walletBalancePoysha: {
                  decrement: ride.totalFarePoysha,
                },
              },
            });
          }
        }
      }

      for (const ride of activeRides) {
        await tx.rideStatusLog.create({
          data: {
            rideId: ride.id,
            previousStatus: ride.status,
            newStatus: targetStatus,
            changedBy: driverId,
          },
        });
      }

      return {
        poolId: updatedPool.id,
        status: updatedPool.status,
        rideStatus: targetStatus,
        updatedRidesCount: activeRideIds.length,
      };
    });
  }

  async getDriverHistory(driverId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { driverId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found for this driver');
    }

    const pools = await this.prisma.pool.findMany({
      where: {
        vehicleId: vehicle.id,
        status: PoolStatus.COMPLETED,
      },
      include: {
        rideRequests: {
          include: {
            passenger: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return pools.map((pool) => {
      const totalEarningsPoysha = pool.rideRequests
        .filter((r) => r.status === RideStatus.COMPLETED)
        .reduce((sum, r) => sum + r.totalFarePoysha, 0);

      return {
        poolId: pool.id,
        pickupZone: pool.pickupZone,
        corridor: pool.corridor,
        status: pool.status,
        occupiedSeats: pool.occupiedSeats,
        createdAt: pool.createdAt,
        totalEarningsBdt: Number((totalEarningsPoysha / 100).toFixed(2)),
        passengers: pool.rideRequests.map((ride) => ({
          rideId: ride.id,
          name: ride.passenger.name,
          pickup: ride.pickupZone,
          drop: ride.destinationZone,
          seats: ride.seatsRequested,
          status: ride.status,
          paymentMethod: ride.paymentMethod,
          fareBdt: Number((ride.totalFarePoysha / 100).toFixed(2)),
        })),
      };
    });
  }
}
