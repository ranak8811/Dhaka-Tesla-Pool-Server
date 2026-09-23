export interface DhakaZone {
  id: string;
  name: string;
  corridor: string;
  isHub: boolean;
}

export const DHAKA_ZONES: DhakaZone[] = [
  { id: 'banani', name: 'Banani', corridor: 'SouthEast', isHub: true },
  { id: 'mohakhali', name: 'Mohakhali', corridor: 'SouthEast', isHub: false },
  { id: 'gulshan1', name: 'Gulshan 1', corridor: 'SouthEast', isHub: false },
  { id: 'gulshan2', name: 'Gulshan 2', corridor: 'SouthEast', isHub: false },
  { id: 'dhanmondi', name: 'Dhanmondi', corridor: 'SouthWest', isHub: false },
  { id: 'farmgate', name: 'Farmgate', corridor: 'Central', isHub: false },
  { id: 'mirpur10', name: 'Mirpur 10', corridor: 'West', isHub: false },
  { id: 'uttara', name: 'Uttara', corridor: 'North', isHub: false },
];

/**
 * Deterministic distance matrix in kilometers across the 8 Dhaka zones.
 * Symmetrical and hand-calibrated for predictable, deterministic fare calculations.
 */
export const DISTANCE_MATRIX_KM: Record<string, Record<string, number>> = {
  banani: {
    banani: 0.5,
    mohakhali: 3.5,
    gulshan1: 3.0,
    gulshan2: 2.0,
    farmgate: 6.0,
    mirpur10: 7.5,
    uttara: 8.5,
    dhanmondi: 9.0,
  },
  mohakhali: {
    banani: 3.5,
    mohakhali: 0.5,
    gulshan1: 2.5,
    gulshan2: 4.0,
    farmgate: 3.0,
    mirpur10: 7.0,
    uttara: 11.0,
    dhanmondi: 6.5,
  },
  gulshan1: {
    banani: 3.0,
    mohakhali: 2.5,
    gulshan1: 0.5,
    gulshan2: 1.8,
    farmgate: 4.5,
    mirpur10: 8.5,
    uttara: 10.5,
    dhanmondi: 8.0,
  },
  gulshan2: {
    banani: 2.0,
    mohakhali: 4.0,
    gulshan1: 1.8,
    gulshan2: 0.5,
    farmgate: 5.5,
    mirpur10: 8.0,
    uttara: 9.0,
    dhanmondi: 9.5,
  },
  dhanmondi: {
    banani: 9.0,
    mohakhali: 6.5,
    gulshan1: 8.0,
    gulshan2: 9.5,
    farmgate: 4.0,
    mirpur10: 6.0,
    uttara: 14.0,
    dhanmondi: 0.5,
  },
  farmgate: {
    banani: 6.0,
    mohakhali: 3.0,
    gulshan1: 4.5,
    gulshan2: 5.5,
    farmgate: 0.5,
    mirpur10: 5.0,
    uttara: 12.0,
    dhanmondi: 4.0,
  },
  mirpur10: {
    banani: 7.5,
    mohakhali: 7.0,
    gulshan1: 8.5,
    gulshan2: 8.0,
    farmgate: 5.0,
    mirpur10: 0.5,
    uttara: 9.0,
    dhanmondi: 6.0,
  },
  uttara: {
    banani: 8.5,
    mohakhali: 11.0,
    gulshan1: 10.5,
    gulshan2: 9.0,
    farmgate: 12.0,
    mirpur10: 9.0,
    uttara: 0.5,
    dhanmondi: 14.0,
  },
};
