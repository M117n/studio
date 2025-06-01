import { AppSpecificUnit } from '@/types/inventory';

// Units that intentionally have no conversion factors
export const NON_CONVERTIBLE_UNITS: readonly AppSpecificUnit[] = [
  AppSpecificUnit.CASE, AppSpecificUnit.BAG, AppSpecificUnit.BOTTLE, AppSpecificUnit.CAN, AppSpecificUnit.PIECE,
] as const;

// Conversion factors between units (US customary units only)
export const factors: Partial<Record<AppSpecificUnit, Partial<Record<AppSpecificUnit, number>>>> = {
  // Weight conversions
  [AppSpecificUnit.KG]: { [AppSpecificUnit.G]: 1000, [AppSpecificUnit.LB]: 2.20462, [AppSpecificUnit.OZ]: 35.274 },
  [AppSpecificUnit.G]: { [AppSpecificUnit.KG]: 0.001, [AppSpecificUnit.LB]: 0.00220462, [AppSpecificUnit.OZ]: 0.035274 },
  [AppSpecificUnit.LB]: { [AppSpecificUnit.KG]: 0.453592, [AppSpecificUnit.G]: 453.592, [AppSpecificUnit.OZ]: 16 },
  [AppSpecificUnit.OZ]: { [AppSpecificUnit.KG]: 0.0283495, [AppSpecificUnit.G]: 28.3495, [AppSpecificUnit.LB]: 0.0625 },
  
  // Volume conversions (US Customary)
  [AppSpecificUnit.L]: {
    [AppSpecificUnit.ML]: 1000,
    [AppSpecificUnit.US_GALLON]: 0.264172,
    [AppSpecificUnit.US_QUART]: 1.05669,
    [AppSpecificUnit.US_PINT]: 2.11338,
    [AppSpecificUnit.US_FLUID_OZ]: 33.814
  },
  
  [AppSpecificUnit.ML]: {
    [AppSpecificUnit.L]: 0.001,
    [AppSpecificUnit.US_GALLON]: 0.000264172,
    [AppSpecificUnit.US_QUART]: 0.00105669,
    [AppSpecificUnit.US_PINT]: 0.00211338,
    [AppSpecificUnit.US_FLUID_OZ]: 0.033814
  },
  
  [AppSpecificUnit.US_GALLON]: { 
    [AppSpecificUnit.L]: 3.78541, 
    [AppSpecificUnit.ML]: 3785.41, 
    [AppSpecificUnit.US_QUART]: 4, 
    [AppSpecificUnit.US_PINT]: 8, 
    [AppSpecificUnit.US_FLUID_OZ]: 128 
  },
  
  [AppSpecificUnit.US_QUART]: { 
    [AppSpecificUnit.L]: 0.946353, 
    [AppSpecificUnit.ML]: 946.353, 
    [AppSpecificUnit.US_GALLON]: 0.25, 
    [AppSpecificUnit.US_PINT]: 2, 
    [AppSpecificUnit.US_FLUID_OZ]: 32 
  },
  
  [AppSpecificUnit.US_PINT]: { 
    [AppSpecificUnit.L]: 0.473176, 
    [AppSpecificUnit.ML]: 473.176, 
    [AppSpecificUnit.US_GALLON]: 0.125, 
    [AppSpecificUnit.US_QUART]: 0.5, 
    [AppSpecificUnit.US_FLUID_OZ]: 16 
  },
  
  [AppSpecificUnit.US_FLUID_OZ]: { 
    [AppSpecificUnit.L]: 0.0295735, 
    [AppSpecificUnit.ML]: 29.5735, 
    [AppSpecificUnit.US_GALLON]: 0.0078125, 
    [AppSpecificUnit.US_QUART]: 0.03125, 
    [AppSpecificUnit.US_PINT]: 0.0625,
    [AppSpecificUnit.IMP_FLUID_OZ]: 1.04084
  },

  // Imperial volume units
  [AppSpecificUnit.IMP_GALLON]: { 
    [AppSpecificUnit.L]: 4.54609, 
    [AppSpecificUnit.ML]: 4546.09, 
    [AppSpecificUnit.IMP_QUART]: 4, 
    [AppSpecificUnit.IMP_PINT]: 8, 
    [AppSpecificUnit.IMP_FLUID_OZ]: 160,
    [AppSpecificUnit.US_GALLON]: 1.20095,
    [AppSpecificUnit.US_QUART]: 4.8038,
    [AppSpecificUnit.US_PINT]: 9.6076,
    [AppSpecificUnit.US_FLUID_OZ]: 153.722
  },
  [AppSpecificUnit.IMP_QUART]: { 
    [AppSpecificUnit.L]: 1.13652, 
    [AppSpecificUnit.ML]: 1136.52, 
    [AppSpecificUnit.IMP_GALLON]: 0.25, 
    [AppSpecificUnit.IMP_PINT]: 2, 
    [AppSpecificUnit.IMP_FLUID_OZ]: 40,
    [AppSpecificUnit.US_QUART]: 1.20095,
    [AppSpecificUnit.US_PINT]: 2.4019,
    [AppSpecificUnit.US_FLUID_OZ]: 38.4304
  },
  [AppSpecificUnit.IMP_PINT]: { 
    [AppSpecificUnit.L]: 0.568261, 
    [AppSpecificUnit.ML]: 568.261, 
    [AppSpecificUnit.IMP_GALLON]: 0.125, 
    [AppSpecificUnit.IMP_QUART]: 0.5, 
    [AppSpecificUnit.IMP_FLUID_OZ]: 20,
    [AppSpecificUnit.US_PINT]: 1.20095,
    [AppSpecificUnit.US_FLUID_OZ]: 19.2152
  },
  [AppSpecificUnit.IMP_FLUID_OZ]: { 
    [AppSpecificUnit.L]: 0.0284131, 
    [AppSpecificUnit.ML]: 28.4131, 
    [AppSpecificUnit.IMP_GALLON]: 0.00625, 
    [AppSpecificUnit.IMP_QUART]: 0.025, 
    [AppSpecificUnit.IMP_PINT]: 0.05,
    [AppSpecificUnit.US_FLUID_OZ]: 0.96076
  },
};

/**
 * Convert a value from one unit to another.
 * Returns the converted value, or null if conversion is not available.
 */
export function convertUnits(value: number, fromUnit: AppSpecificUnit, toUnit: AppSpecificUnit): number | null {
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