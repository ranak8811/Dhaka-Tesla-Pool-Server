import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Pool, PoolStatus, Vehicle } from '@prisma/client';

@Injectable()
export class PoolsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds an existing OPEN pool on the same corridor with enough available seats.
   */
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

    // Pick first pool that has enough capacity (<= 3)
    const matched = pools.find((p) => p.occupiedSeats + seatsNeeded <= 3);
    return matched || null;
  }

  /**
   * Finds an online vehicle ready to start a new pool.
   * A vehicle is available if isOnline is true and it has no active (OPEN, FULL, IN_TRANSIT) pools.
   */
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

  /**
   * Creates a new pool for an available vehicle.
   */
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

  /**
   * Increments occupied seats on an existing pool and marks FULL if capacity reached.
   */
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
