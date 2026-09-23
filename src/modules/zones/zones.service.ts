import { BadRequestException, Injectable } from '@nestjs/common';
import { DHAKA_ZONES, DISTANCE_MATRIX_KM, DhakaZone } from '../../common/constants/zones.constants.js';

@Injectable()
export class ZonesService {
  /**
   * Returns all predefined Dhaka hubs and zones.
   */
  getAllZones(): DhakaZone[] {
    return DHAKA_ZONES;
  }

  /**
   * Finds a zone by either its ID (e.g. 'banani') or Name (e.g. 'Banani').
   */
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

  /**
   * Looks up deterministic distance in kilometers between two Dhaka zones.
   */
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

  /**
   * Checks whether two destinations share a compatible corridor.
   * As specified in PRD Section 1: SouthEast corridor includes Banani, Gulshan 1, Gulshan 2, Mohakhali.
   */
  areCorridorsCompatible(destA: string, destB: string): boolean {
    const zoneA = this.getZone(destA);
    const zoneB = this.getZone(destB);

    return zoneA.corridor === zoneB.corridor;
  }
}
