// ---------------------------------------------------------------------------
// Centralised domain constants
// ---------------------------------------------------------------------------

export type Category = "cooler" | "freezer" | "dry" | "canned" | "other";

export const CATEGORY_OPTIONS: readonly Category[] = [
  "cooler",
  "freezer",
  "dry",
  "canned",
  "other",
] as const;

export type SubCategory =
  | "fruit" | "vegetables" | "juices" | "dairy"
  | "meats" | "cooked meats" | "frozen vegetables"
  | "bread" | "desserts" | "soups" | "dressings"
  | "dry" | "canned" | "other";

export const SUBCATEGORY_OPTIONS: readonly SubCategory[] = [
  "fruit","vegetables","juices","dairy",
  "meats","cooked meats","frozen vegetables",
  "bread","desserts","soups","dressings",
  "dry","canned","other",
] as const;

export type Unit =
  | "kg" | "g" | "lb" | "oz"
  | "L" | "mL"
  | "us_gallon" | "us_quart" | "us_pint" | "us_fluid_oz"
  | "imp_gallon" | "imp_quart" | "imp_pint" | "imp_fluid_oz"
  | "case" | "bag" | "bottle" | "can" | "piece";

export const UNIT_OPTIONS: readonly Unit[] = [
  "kg","g","lb","oz",
  "L","mL",
  "us_gallon","us_quart","us_pint","us_fluid_oz",
  "imp_gallon","imp_quart","imp_pint","imp_fluid_oz",
  "case","bag","bottle","can","piece",
] as const;

/* helper – import everywhere instead of re‑declaring */
export const getMainCategory = (sub: SubCategory): Category => {
  if (["fruit","vegetables","juices","dairy"].includes(sub)) return "cooler";
  if (["meats","cooked meats","frozen vegetables","bread","desserts","soups","dressings"].includes(sub)) return "freezer";
  if (sub === "dry")    return "dry";
  if (sub === "canned") return "canned";
  return "other";
};

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: Unit;
  category?: Category;
  subcategory?: SubCategory;
}

export type InventoryItemData = Omit<InventoryItem, "id">;