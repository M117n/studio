import type { Unit } from '@/types/inventory';

// Units that intentionally have no conversion factors
export const NON_CONVERTIBLE_UNITS: readonly Unit[] = [
  "case", "bag", "bottle", "can", "piece",
] as const;

// Conversion factors between units (US customary units only)
export const factors: Partial<Record<Unit, Partial<Record<Unit, number>>>> = {
  // Weight conversions
  kg: { g: 1000, lb: 2.20462, oz: 35.274 },
  g: { kg: 0.001, lb: 0.00220462, oz: 0.035274 },
  lb: { kg: 0.453592, g: 453.592, oz: 16 },
  oz: { kg: 0.0283495, g: 28.3495, lb: 0.0625 },
  
  // Volume conversions (US Customary)
  L: {
    mL: 1000,
    us_gallon: 0.264172,
    us_quart: 1.05669,
    us_pint: 2.11338,
    us_fluid_oz: 33.814
  },
  
  mL: {
    L: 0.001,
    us_gallon: 0.000264172,
    us_quart: 0.00105669,
    us_pint: 0.00211338,
    us_fluid_oz: 0.033814
  },
  
  us_gallon: { 
    L: 3.78541, 
    mL: 3785.41, 
    us_quart: 4, 
    us_pint: 8, 
    us_fluid_oz: 128 
  },
  
  us_quart: { 
    L: 0.946353, 
    mL: 946.353, 
    us_gallon: 0.25, 
    us_pint: 2, 
    us_fluid_oz: 32 
  },
  
  us_pint: { 
    L: 0.473176, 
    mL: 473.176, 
    us_gallon: 0.125, 
    us_quart: 0.5, 
    us_fluid_oz: 16 
  },
  
  us_fluid_oz: { 
    L: 0.0295735, 
    mL: 29.5735, 
    us_gallon: 0.0078125, 
    us_quart: 0.03125, 
    us_pint: 0.0625,
    imp_fluid_oz: 1.04084
  },

  // Imperial volume units
  imp_gallon: { 
    L: 4.54609, 
    mL: 4546.09, 
    imp_quart: 4, 
    imp_pint: 8, 
    imp_fluid_oz: 160,
    us_gallon: 1.20095,
    us_quart: 4.8038,
    us_pint: 9.6076,
    us_fluid_oz: 153.722
  },
  imp_quart: { 
    L: 1.13652, 
    mL: 1136.52, 
    imp_gallon: 0.25, 
    imp_pint: 2, 
    imp_fluid_oz: 40,
    us_quart: 1.20095,
    us_pint: 2.4019,
    us_fluid_oz: 38.4304
  },
  imp_pint: { 
    L: 0.568261, 
    mL: 568.261, 
    imp_gallon: 0.125, 
    imp_quart: 0.5, 
    imp_fluid_oz: 20,
    us_pint: 1.20095,
    us_fluid_oz: 19.2152
  },
  imp_fluid_oz: { 
    L: 0.0284131, 
    mL: 28.4131, 
    imp_gallon: 0.00625, 
    imp_quart: 0.025, 
    imp_pint: 0.05,
    us_fluid_oz: 0.96076
  },
};

/**
 * Convert a value from one unit to another.
 * Returns the converted value, or null if conversion is not available.
 */
export function convertUnits(value: number, fromUnit: Unit, toUnit: Unit): number | null {
  if (fromUnit === toUnit) return value;
  // Hard stop for the five non‑convertible units
  if (
    NON_CONVERTIBLE_UNITS.includes(fromUnit) ||
    NON_CONVERTIBLE_UNITS.includes(toUnit)
  ) {
    return null;
  }

  const factor = factors[fromUnit]?.[toUnit];
  return factor != null ? value * factor : null;
}