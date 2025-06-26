// ---------------------------------------------------------------------------
// Centralised domain constants
// ---------------------------------------------------------------------------

import { AppTimestamp } from './timestamp';

// USER ACTION: Replace these placeholder enums with your actual application-specific enums.
export enum Category {
  COOLER = "cooler",
  FREEZER = "freezer",
  DRY = "dry",
  CANNED = "canned",
  OTHER = "other",
}

export enum SubCategory {
  FRUIT = "fruit",
  VEGETABLES = "vegetables",
  JUICES = "juices",
  DAIRY = "dairy",
  MEATS = "meats",
  COOKED_MEATS = "cooked meats",
  FROZEN_VEGETABLES = "frozen vegetables",
  BREAD = "bread",
  DESSERTS = "desserts",
  SOUPS = "soups",
  DRESSINGS = "dressings",
  DRY = "dry",
  CANNED = "canned",
  OTHER = "other",
}

export enum AppSpecificUnit {
  KG = "kg",
  G = "g",
  LB = "lb",
  OZ = "oz",
  L = "L",
  ML = "mL",
  US_GALLON = "us_gallon",
  US_QUART = "us_quart",
  US_PINT = "us_pint",
  US_FLUID_OZ = "us_fluid_oz",
  IMP_GALLON = "imp_gallon",
  IMP_QUART = "imp_quart",
  IMP_PINT = "imp_pint",
  IMP_FLUID_OZ = "imp_fluid_oz",
  CASE = "case",
  BAG = "bag",
  BOTTLE = "bottle",
  CAN = "can",
  PIECE = "piece",
}

// ---------------------------------------------------------------------------
// Convenience Types & Option Arrays
// ---------------------------------------------------------------------------

// Backwards-compatibility alias – many components still reference `Unit`
export type Unit = AppSpecificUnit;

// All available units / sub-categories as read-only arrays for UI selects etc.
export const UNIT_OPTIONS: readonly AppSpecificUnit[] = Object.values(AppSpecificUnit) as readonly AppSpecificUnit[];
export const SUBCATEGORY_OPTIONS: readonly SubCategory[]   = Object.values(SubCategory)   as readonly SubCategory[];

// Validation Functions
// These functions check if a given string value is a valid member of the respective enum.

export const isValidCategory = (value: any): value is Category => {
  return Object.values(Category).includes(value as Category);
};

export const isValidSubCategory = (value: any): value is SubCategory => {
  return Object.values(SubCategory).includes(value as SubCategory);
};

export const isValidUnit = (value: any): value is AppSpecificUnit => {
  return Object.values(AppSpecificUnit).includes(value as AppSpecificUnit);
};

export interface InventoryItem {
  id: string;
  name: string;
  normalizedName?: string; // For case-insensitive search
  quantity: number;
  unit: AppSpecificUnit;
  category?: Category;
  subcategory?: SubCategory;
  lastUpdated?: AppTimestamp;
}

export type InventoryItemData = Omit<InventoryItem, "id">;

/* helper – import everywhere instead of re‑declaring */
export const getMainCategory = (sub: SubCategory): Category => {
  if (["fruit","vegetables","juices","dairy"].includes(sub)) return Category.COOLER;
  if (["meats","cooked meats","frozen vegetables","bread","desserts","soups","dressings"].includes(sub)) return Category.FREEZER;
  if (sub === "dry")    return Category.DRY;
  if (sub === "canned") return Category.CANNED;
  return Category.OTHER;
};