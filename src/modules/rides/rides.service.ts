import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ZonesService } from '../zones/zones.service.js';
import { PricingService } from './pricing.service.js';
import { PoolsService } from '../pools/pools.service.js';
import { CreateRideDto } from './dto/create-ride.dto.js';
import { PoolStatus, RideStatus } from '@prisma/client';

@Injectable()
export class RidesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zonesService: ZonesService,
    private readonly pricingService: PricingService,
    private readonly poolsService: PoolsService,
  ) {}

  async requestRide(passengerId: string, dto: CreateRideDto) {
    const seatsRequested = dto.seatsRequested || dto.seats || 1;
    if (seatsRequested < 1 || seatsRequested > 3) {
      throw new BadRequestException('Seats requested must be between 1 and 3');
    }

    const existingActiveRide = await this.prisma.rideRequest.findFirst({
      where: {
        passengerId,
        status: {
          in: [
            RideStatus.REQUESTED,
            RideStatus.MATCHED,
            RideStatus.DRIVER_ARRIVED,
            RideStatus.STARTED,
          ],
        },
      },
    });

    if (existingActiveRide) {
      throw new BadRequestException('You already have an active ride request in progress');
    }

    if (dto.poolId) {
      const targetPool = await this.prisma.pool.findUnique({
        where: { id: dto.poolId },
      });

      if (!targetPool) {
        throw new NotFoundException(`Pool with id ${dto.poolId} not found`);
      }

      const pickupZoneName = dto.pickupZone || targetPool.pickupZone;
      const destinationZoneName =
        dto.destinationZone ||
        (targetPool.corridor === 'SouthEast' ? 'Mohakhali' : 'Farmgate');

      const fromZone = this.zonesService.getZone(pickupZoneName);
      const toZone = this.zonesService.getZone(destinationZoneName);
      const distanceKm = this.zonesService.getDistanceKm(fromZone.id, toZone.id);
      const fare = this.pricingService.calculateFare(distanceKm, true);
      const scaledFare = {
        baseFarePoysha: fare.baseFarePoysha * seatsRequested,
        distanceChargePoysha: fare.distanceChargePoysha * seatsRequested,
        poolDiscountPoysha: fare.poolDiscountPoysha * seatsRequested,
        totalFarePoysha: fare.totalFarePoysha * seatsRequested,
      };

      return await this.poolsService.reserveSeatAtomic(
        targetPool.id,
        passengerId,
        seatsRequested,
        {
          pickupZone: fromZone.name,
          destinationZone: toZone.name,
          ...scaledFare,
        },
      );
    }

    if (!dto.pickupZone || !dto.destinationZone) {
      throw new BadRequestException(
        'Please provide both pickupZone and destinationZone to book a ride',
      );
    }

    const fromZone = this.zonesService.getZone(dto.pickupZone);
    const toZone = this.zonesService.getZone(dto.destinationZone);
    const distanceKm = this.zonesService.getDistanceKm(fromZone.id, toZone.id);
    const fare = this.pricingService.calculateFare(distanceKm, true);

    const scaledFare = {
      baseFarePoysha: fare.baseFarePoysha * seatsRequested,
      distanceChargePoysha: fare.distanceChargePoysha * seatsRequested,
      poolDiscountPoysha: fare.poolDiscountPoysha * seatsRequested,
      totalFarePoysha: fare.totalFarePoysha * seatsRequested,
    };

    const pool = await this.poolsService.findCompatibleOpenPool(
      fromZone.name,
      toZone.corridor,
      seatsRequested,
    );

    if (pool) {
      return await this.poolsService.reserveSeatAtomic(
        pool.id,
        passengerId,
        seatsRequested,
        {
          pickupZone: fromZone.name,
          destinationZone: toZone.name,
          ...scaledFare,
        },
      );
    }

    const vehicle = await this.poolsService.findAvailableOnlineVehicle();
    if (!vehicle) {
      throw new BadRequestException(
        'No online Tesla drivers available at the moment. Please try again shortly.',
      );
    }

    return await this.poolsService.createPoolWithRide(
      vehicle.id,
      passengerId,
      fromZone.name,
      toZone.name,
      toZone.corridor,
      seatsRequested,
      scaledFare,
    );
  }

  async getActiveRide(passengerId: string) {
    return this.prisma.rideRequest.findFirst({
      where: {
        passengerId,
        status: {
          in: [
            RideStatus.REQUESTED,
            RideStatus.MATCHED,
            RideStatus.DRIVER_ARRIVED,
            RideStatus.STARTED,
          ],
        },
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
  }

  async cancelRide(rideId: string, userId: string) {
    const ride = await this.prisma.rideRequest.findUnique({
      where: { id: rideId },
      include: { pool: true },
    });

    if (!ride) {
      throw new NotFoundException(`Ride with id ${rideId} not found`);
    }

    if (ride.passengerId !== userId) {
      throw new ForbiddenException('You can only cancel your own rides');
    }

    if (ride.status === RideStatus.CANCELLED) {
      throw new BadRequestException('Ride is already cancelled');
    }

    if (
      ride.status === RideStatus.STARTED ||
      ride.status === RideStatus.COMPLETED
    ) {
      throw new BadRequestException('Cannot cancel ride in transit or already completed');
    }

    return await this.prisma.$transaction(async (tx) => {
      const updatedRide = await tx.rideRequest.update({
        where: { id: rideId },
        data: { status: RideStatus.CANCELLED },
      });

      await tx.rideStatusLog.create({
        data: {
          rideId,
          previousStatus: ride.status,
          newStatus: RideStatus.CANCELLED,
          changedBy: userId,
        },
      });

      if (ride.poolId && ride.pool) {
        const remainingSeats = Math.max(
          0,
          ride.pool.occupiedSeats - ride.seatsRequested,
        );
        const newPoolStatus =
          ride.pool.status === PoolStatus.FULL && remainingSeats < 3
            ? PoolStatus.OPEN
            : ride.pool.status;

        await tx.pool.update({
          where: { id: ride.poolId },
          data: {
            occupiedSeats: remainingSeats,
            status: newPoolStatus,
          },
        });
      }

      return {
        rideId: updatedRide.id,
        status: RideStatus.CANCELLED,
        message: 'Ride cancelled successfully. Seat released.',
      };
    });
  }
}
