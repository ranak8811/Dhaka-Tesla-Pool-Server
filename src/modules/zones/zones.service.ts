import { BadRequestException, Injectable } from '@nestjs/common';
import { DHAKA_ZONES, DISTANCE_MATRIX_KM, DhakaZone } from '../../common/constants/zones.constants.js';

@Injectable()
export class ZonesService {
  getAllZones(): DhakaZone[] {
    return DHAKA_ZONES;
  }

  getZone(idOrName: string): DhakaZone {
    const normalized = idOrName.toLowerCase().replace(/\s+/g, '');
    const zone = DHAKA_ZONES.find(
      (z) =>
        z.id.toLowerCase() === normalized ||
        z.name.toLowerCase().replace(/\s+/g, '') === normalized,
    );

    if (!zone) {
      throw new BadRequestException(`Unknown zone: "${idOrName}"`);
    }

    return zone;
  }

  getDistanceKm(fromZone: string, toZone: string): number {
    const origin = this.getZone(fromZone);
    const destination = this.getZone(toZone);

    const distance = DISTANCE_MATRIX_KM[origin.id]?.[destination.id];
    if (distance === undefined) {
      throw new BadRequestException(
        `Distance not mapped between "${fromZone}" and "${toZone}"`,
      );
    }

    return distance;
  }

  areCorridorsCompatible(destA: string, destB: string): boolean {
    const zoneA = this.getZone(destA);
    const zoneB = this.getZone(destB);

    return zoneA.corridor === zoneB.corridor;
  }
}
