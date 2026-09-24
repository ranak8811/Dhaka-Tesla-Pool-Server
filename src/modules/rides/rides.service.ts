import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ZonesService } from '../zones/zones.service.js';
import { PricingService } from './pricing.service.js';
import { PoolsService } from '../pools/pools.service.js';
import { CreateRideDto } from './dto/create-ride.dto.js';
import { PaymentStatus, RideStatus } from '@prisma/client';

@Injectable()
export class RidesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zonesService: ZonesService,
    private readonly pricingService: PricingService,
    private readonly poolsService: PoolsService,
  ) {}

  /**
   * Books a ride for a passenger, finding an existing open pool or creating a new one.
   */
  async requestRide(passengerId: string, dto: CreateRideDto) {
    const seatsRequested = dto.seatsRequested || 1;

    // 1. Verify passenger does not already have an active ride
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

    // 2. Validate zones and compute deterministic distance
    const fromZone = this.zonesService.getZone(dto.pickupZone);
    const toZone = this.zonesService.getZone(dto.destinationZone);
    const distanceKm = this.zonesService.getDistanceKm(fromZone.id, toZone.id);

    // 3. Compute fair poysha pricing (pooled discount applied)
    const fare = this.pricingService.calculateFare(distanceKm, true);

    // 4. Corridor matching: look for an open pool heading along the same corridor
    let pool = await this.poolsService.findCompatibleOpenPool(
      fromZone.name,
      toZone.corridor,
      seatsRequested,
    );

    if (pool) {
      // 5. Existing pool found: join the pool and update seat count
      await this.poolsService.addSeatsToPool(pool.id, seatsRequested);
    } else {
      // 6. No open pool found: find an available online driver/vehicle to create one
      const vehicle = await this.poolsService.findAvailableOnlineVehicle();
      if (!vehicle) {
        throw new BadRequestException(
          'No online Tesla drivers available at the moment. Please try again shortly.',
        );
      }

      pool = await this.poolsService.createPool(
        vehicle.id,
        fromZone.name,
        toZone.corridor,
        seatsRequested,
      );
    }

    // 7. Create the ride request record
    const ride = await this.prisma.rideRequest.create({
      data: {
        passengerId,
        poolId: pool.id,
        pickupZone: fromZone.name,
        destinationZone: toZone.name,
        seatsRequested,
        status: RideStatus.MATCHED,
        baseFarePoysha: fare.baseFarePoysha,
        distanceChargePoysha: fare.distanceChargePoysha,
        poolDiscountPoysha: fare.poolDiscountPoysha,
        totalFarePoysha: fare.totalFarePoysha,
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

    // 8. Log the initial state transition
    await this.prisma.rideStatusLog.create({
      data: {
        rideId: ride.id,
        previousStatus: null,
        newStatus: RideStatus.MATCHED,
        changedBy: passengerId,
      },
    });

    return ride;
  }

  /**
   * Retrieves the currently active ride for a passenger, if any.
   */
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
}
