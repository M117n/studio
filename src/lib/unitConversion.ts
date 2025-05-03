import type { Unit } from '@/types/inventory';

// Conversion factors between units
export const factors: Partial<Record<Unit, Partial<Record<Unit, number>>>> = {
  kg: { g: 1000, lb: 2.20462, oz: 35.274 },
  g: { kg: 0.001, lb: 0.00220462, oz: 0.035274 },
  lb: { kg: 0.453592, g: 453.592, oz: 16 },
  oz: { kg: 0.0283495, g: 28.3495, lb: 0.0625 },
  L: {
    mL: 1000,
    'gallon (US)': 0.264172,
    'quart (US)': 1.05669,
    'pint (US)': 2.11338,
    'fluid oz (US)': 33.814,
    'gallon (UK)': 0.219969,
    'quart (UK)': 0.879877,
    'pint (UK)': 1.75975,
    'fluid oz (UK)': 35.1951,
  },
  mL: {
    L: 0.001,
    'gallon (US)': 0.000264172,
    'quart (US)': 0.00105669,
    'pint (US)': 0.00211338,
    'fluid oz (US)': 0.033814,
    'gallon (UK)': 0.000219969,
    'quart (UK)': 0.000879877,
    'pint (UK)': 0.00175975,
    'fluid oz (UK)': 0.0351951,
  },
  'gallon (US)': { L: 3.78541, mL: 3785.41, 'quart (US)': 4, 'pint (US)': 8, 'fluid oz (US)': 128 },
  'quart (US)': { L: 0.946353, mL: 946.353, 'gallon (US)': 0.25, 'pint (US)': 2, 'fluid oz (US)': 32 },
  'pint (US)': { L: 0.473176, mL: 473.176, 'gallon (US)': 0.125, 'quart (US)': 0.5, 'fluid oz (US)': 16 },
  'fluid oz (US)': { L: 0.0295735, mL: 29.5735, 'gallon (US)': 0.0078125, 'quart (US)': 0.03125, 'pint (US)': 0.0625 },
  'gallon (UK)': { L: 4.54609, mL: 4546.09, 'quart (UK)': 4, 'pint (UK)': 8, 'fluid oz (UK)': 160 },
  'quart (UK)': { L: 1.13652, mL: 1136.52, 'gallon (UK)': 0.25, 'pint (UK)': 2, 'fluid oz (UK)': 40 },
  'pint (UK)': { L: 0.568261, mL: 568.261, 'gallon (UK)': 0.125, 'quart (UK)': 0.5, 'fluid oz (UK)': 20 },
  'fluid oz (UK)': { L: 0.0284131, mL: 28.4131, 'gallon (UK)': 0.00625, 'quart (UK)': 0.025, 'pint (UK)': 0.05 },
};

/**
 * Convert a value from one unit to another.
 * Returns the converted value, or null if conversion is not available.
 */
export function convertUnits(value: number, fromUnit: Unit, toUnit: Unit): number | null {
  if (fromUnit === toUnit) return value;
  const factor = factors[fromUnit]?.[toUnit];
  return factor != null ? value * factor : null;
}