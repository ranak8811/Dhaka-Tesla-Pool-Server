import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PaymentStatus, Pool, PoolStatus, RideStatus, Vehicle } from '@prisma/client';

export interface FareCalculationDetails {
  pickupZone: string;
  destinationZone: string;
  baseFarePoysha: number;
  distanceChargePoysha: number;
  poolDiscountPoysha: number;
  totalFarePoysha: number;
}

@Injectable()
export class PoolsService {
  constructor(private readonly prisma: PrismaService) {}

  async findCompatibleOpenPool(
    pickupZone: string,
    corridor: string,
    seatsNeeded = 1,
  ): Promise<Pool | null> {
    const pools = await this.prisma.pool.findMany({
      where: {
        status: PoolStatus.OPEN,
        pickupZone: { equals: pickupZone, mode: 'insensitive' },
        corridor: { equals: corridor, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'asc' },
    });

    return pools.find((p) => p.occupiedSeats + seatsNeeded <= 3) || null;
  }

  async findAvailableOnlineVehicle(): Promise<Vehicle | null> {
    return this.prisma.vehicle.findFirst({
      where: {
        isOnline: true,
        pools: {
          none: {
            status: { in: [PoolStatus.OPEN, PoolStatus.FULL, PoolStatus.IN_TRANSIT] },
          },
        },
      },
      include: {
        driver: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async reserveSeatAtomic(
    poolId: string,
    passengerId: string,
    seatsRequested: number,
    fareDetails: FareCalculationDetails,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const pools = await tx.$queryRaw<
        Array<{
          id: string;
          vehicle_id: string;
          status: PoolStatus;
          occupied_seats: number;
          pickup_zone: string;
          corridor: string;
        }>
      >`
        SELECT id, vehicle_id, status, occupied_seats, pickup_zone, corridor
        FROM "pools"
        WHERE id = ${poolId}
        FOR UPDATE
      `;

      if (!pools || pools.length === 0) {
        throw new NotFoundException(`Pool with id ${poolId} not found`);
      }

      const currentPool = pools[0];

      if (currentPool.status !== PoolStatus.OPEN) {
        throw new ConflictException(
          `Pool is not open for booking. Current status is ${currentPool.status}.`,
        );
      }

      const newOccupiedSeats = currentPool.occupied_seats + seatsRequested;
      if (newOccupiedSeats > 3) {
        throw new ConflictException(
          `Pool capacity exceeded. Only ${Math.max(0, 3 - currentPool.occupied_seats)} seat(s) available in Bullet.`,
        );
      }

      const ride = await tx.rideRequest.create({
        data: {
          passengerId,
          poolId,
          pickupZone: fareDetails.pickupZone,
          destinationZone: fareDetails.destinationZone,
          seatsRequested,
          status: RideStatus.MATCHED,
          baseFarePoysha: fareDetails.baseFarePoysha,
          distanceChargePoysha: fareDetails.distanceChargePoysha,
          poolDiscountPoysha: fareDetails.poolDiscountPoysha,
          totalFarePoysha: fareDetails.totalFarePoysha,
          paymentStatus: PaymentStatus.PENDING,
        },
        include: {
          pool: {
            include: {
              vehicle: {
                include: {
                  driver: {
                    select: { id: true, name: true, email: true },
                  },
                },
              },
            },
          },
        },
      });

      const newStatus = newOccupiedSeats === 3 ? PoolStatus.FULL : PoolStatus.OPEN;
      await tx.pool.update({
        where: { id: poolId },
        data: {
          occupiedSeats: newOccupiedSeats,
          status: newStatus,
        },
      });

      await tx.rideStatusLog.create({
        data: {
          rideId: ride.id,
          previousStatus: null,
          newStatus: RideStatus.MATCHED,
          changedBy: passengerId,
        },
      });

      return ride;
    });
  }

  async createPoolWithRide(
    vehicleId: string,
    passengerId: string,
    pickupZone: string,
    destinationZone: string,
    corridor: string,
    seatsRequested: number,
    fareDetails: {
      baseFarePoysha: number;
      distanceChargePoysha: number;
      poolDiscountPoysha: number;
      totalFarePoysha: number;
    },
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const vehicles = await tx.$queryRaw<
        Array<{
          id: string;
          is_online: boolean;
        }>
      >`
        SELECT id, is_online FROM "vehicles"
        WHERE id = ${vehicleId}
        FOR UPDATE
      `;

      if (!vehicles || vehicles.length === 0) {
        throw new NotFoundException(`Vehicle with id ${vehicleId} not found`);
      }

      const activePool = await tx.pool.findFirst({
        where: {
          vehicleId,
          status: { in: [PoolStatus.OPEN, PoolStatus.FULL, PoolStatus.IN_TRANSIT] },
        },
      });

      if (activePool) {
        throw new ConflictException('Vehicle already has an active pool in progress');
      }

      const status = seatsRequested >= 3 ? PoolStatus.FULL : PoolStatus.OPEN;
      const pool = await tx.pool.create({
        data: {
          vehicleId,
          pickupZone,
          corridor,
          occupiedSeats: seatsRequested,
          status,
        },
      });

      const ride = await tx.rideRequest.create({
        data: {
          passengerId,
          poolId: pool.id,
          pickupZone,
          destinationZone,
          seatsRequested,
          status: RideStatus.MATCHED,
          baseFarePoysha: fareDetails.baseFarePoysha,
          distanceChargePoysha: fareDetails.distanceChargePoysha,
          poolDiscountPoysha: fareDetails.poolDiscountPoysha,
          totalFarePoysha: fareDetails.totalFarePoysha,
          paymentStatus: PaymentStatus.PENDING,
        },
        include: {
          pool: {
            include: {
              vehicle: {
                include: {
                  driver: {
                    select: { id: true, name: true, email: true },
                  },
                },
              },
            },
          },
        },
      });

      await tx.rideStatusLog.create({
        data: {
          rideId: ride.id,
          previousStatus: null,
          newStatus: RideStatus.MATCHED,
          changedBy: passengerId,
        },
      });

      return ride;
    });
  }

  async createPool(
    vehicleId: string,
    pickupZone: string,
    corridor: string,
    initialSeats = 1,
  ): Promise<Pool> {
    const status = initialSeats >= 3 ? PoolStatus.FULL : PoolStatus.OPEN;

    return this.prisma.pool.create({
      data: {
        vehicleId,
        pickupZone,
        corridor,
        occupiedSeats: initialSeats,
        status,
      },
    });
  }

  async addSeatsToPool(poolId: string, seatsToAdd: number): Promise<Pool> {
    const pool = await this.prisma.pool.findUnique({
      where: { id: poolId },
    });

    if (!pool) {
      throw new NotFoundException(`Pool with id ${poolId} not found`);
    }

    const newOccupiedSeats = pool.occupiedSeats + seatsToAdd;
    const newStatus = newOccupiedSeats >= 3 ? PoolStatus.FULL : PoolStatus.OPEN;

    return this.prisma.pool.update({
      where: { id: poolId },
      data: {
        occupiedSeats: newOccupiedSeats,
        status: newStatus,
      },
    });
  }
}
