import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ZonesService } from './zones.service.js';

describe('ZonesService (STORY-007)', () => {
  let zonesService: ZonesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ZonesService],
    }).compile();

    zonesService = module.get<ZonesService>(ZonesService);
  });

  it('should be defined', () => {
    expect(zonesService).toBeDefined();
  });

  describe('Scenario 1: Call GET /api/v1/zones (FR-ZONE-01)', () => {
    it('should return exactly 8 Dhaka zones with Banani as the primary hub', () => {
      const zones = zonesService.getAllZones();

      expect(zones).toHaveLength(8);

      const banani = zones.find((z) => z.id === 'banani');
      expect(banani).toBeDefined();
      expect(banani?.name).toBe('Banani');
      expect(banani?.isHub).toBe(true);
      expect(banani?.corridor).toBe('SouthEast');

      const mohakhali = zones.find((z) => z.id === 'mohakhali');
      expect(mohakhali?.name).toBe('Mohakhali');

      const gulshan1 = zones.find((z) => z.id === 'gulshan1');
      expect(gulshan1?.name).toBe('Gulshan 1');
    });
  });

  describe('Scenario 2: Distance lookup Banani to Mohakhali (FR-ZONE-01)', () => {
    it('should return exactly 3.5 km for Nusrat journey from Banani to Mohakhali', () => {
      const distance = zonesService.getDistanceKm('Banani', 'Mohakhali');
      expect(distance).toBe(3.5);

      // Verify case-insensitivity
      expect(zonesService.getDistanceKm('banani', 'mohakhali')).toBe(3.5);
    });
  });

  describe('Scenario 3: Distance lookup Banani to Gulshan 1 (FR-ZONE-01)', () => {
    it('should return exactly 3.0 km for Rafiq journey from Banani to Gulshan 1', () => {
      const distance = zonesService.getDistanceKm('Banani', 'Gulshan 1');
      expect(distance).toBe(3.0);

      // Verify case-insensitivity and spacing tolerance
      expect(zonesService.getDistanceKm('banani', 'gulshan1')).toBe(3.0);
    });
  });

  describe('Symmetry & Distance Matrix Verification', () => {
    it('should return symmetric distances (Mohakhali to Banani is 3.5 km)', () => {
      expect(zonesService.getDistanceKm('Mohakhali', 'Banani')).toBe(3.5);
      expect(zonesService.getDistanceKm('Gulshan 1', 'Banani')).toBe(3.0);
    });

    it('should throw BadRequestException for unknown zones', () => {
      expect(() => zonesService.getDistanceKm('Banani', 'Chittagong')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('Corridor Compatibility (FR-ZONE-01)', () => {
    it('should return true for destinations on the same SouthEast corridor (Mohakhali and Gulshan 1)', () => {
      const isCompatible = zonesService.areCorridorsCompatible(
        'Mohakhali',
        'Gulshan 1',
      );
      expect(isCompatible).toBe(true);
    });

    it('should return false for destinations on incompatible corridors (Mohakhali vs Uttara)', () => {
      const isCompatible = zonesService.areCorridorsCompatible(
        'Mohakhali',
        'Uttara',
      );
      expect(isCompatible).toBe(false);
    });
  });
});
