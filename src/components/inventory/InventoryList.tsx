"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

/* ------------------------------------------------------------------ */
/*  Types & constants                                                 */
/* ------------------------------------------------------------------ */

type Category =
  | "cooler"
  | "freezer"
  | "dry"
  | "canned"
  | "other"
  | "fruit"
  | "vegetables"
  | "juices"
  | "dairy"
  | "meats"
  | "cooked meats"
  | "frozen vegetables"
  | "bread"
  | "desserts"
  | "soups"
  | "dressings";

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: Category;
}

interface InventoryListProps {
  inventory: InventoryItem[];
  onDeleteItem: (id: string) => void;
  onEditItem: (id: string, payload: Omit<InventoryItem, "id">) => void;
  defaultUnit: string;
  convertUnits: (
    value: number,
    fromUnit: string,
    toUnit: string
  ) => number | null;
  searchQuery: string;
}

const unitOptions = [
  "kg",
  "g",
  "L",
  "mL",
  "units",
  "boxes",
  "pieces",
  "lb",
  "oz",
  "gallon (US)",
  "quart (US)",
  "pint (US)",
  "fluid oz (US)",
  "gallon (UK)",
  "quart (UK)",
  "pint (UK)",
  "fluid oz (UK)",
] as const;

const categoryOptions: Category[] = [
  "cooler",
  "freezer",
  "dry",
  "canned",
  "other",
  "fruit",
  "vegetables",
  "juices",
  "dairy",
  "meats",
  "cooked meats",
  "frozen vegetables",
  "bread",
  "desserts",
  "soups",
  "dressings",
];

const subcategories: Record<string, Category[]> = {
  cooler: ["fruit", "vegetables", "juices", "dairy"],
  freezer: [
    "meats",
    "cooked meats",
    "frozen vegetables",
    "bread",
    "desserts",
    "soups",
    "dressings",
  ],
  dry: [],
  canned: [],
  other: [],
};

const categoryDisplayNames: Record<Category, string> = {
  cooler: "Cooler",
  freezer: "Freezer",
  dry: "Dry",
  canned: "Canned",
  other: "Other",
  fruit: "Fruit",
  vegetables: "Vegetables",
  juices: "Juices",
  dairy: "Dairy",
  meats: "Meats",
  "cooked meats": "Cooked Meats",
  "frozen vegetables": "Frozen Vegetables",
  bread: "Bread",
  desserts: "Desserts",
  soups: "Soups",
  dressings: "Dressings",
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export const InventoryList: React.FC<InventoryListProps> = ({
  inventory,
  onDeleteItem,
  onEditItem,
  defaultUnit,
  convertUnits,
  searchQuery,
}) => {
  /* ---------------------- local state ----------------------------- */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState("");
  const [editedQuantity, setEditedQuantity] = useState<number | "">("");
  const [editedUnit, setEditedUnit] = useState("");
  const [editedCategory, setEditedCategory] = useState<Category>("other");

  /* ---------------------- helpers --------------------------------- */
  const startEditing = (item: InventoryItem) => {
    setEditingId(item.id);
    setEditedName(item.name);
    setEditedQuantity(item.quantity);
    setEditedUnit(item.unit);
    setEditedCategory(item.category);
  };

  const cancelEditing = () => setEditingId(null);

  const saveChanges = () => {
    if (!editingId) return;

    if (!editedName || editedQuantity === "" || !editedUnit) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields.",
      });
      return;
    }

    if (typeof editedQuantity === "string" || isNaN(editedQuantity)) {
      toast({
        variant: "destructive",
        title: "Invalid quantity",
        description: "Quantity must be a number.",
      });
      return;
    }

    onEditItem(editingId, {
      name: editedName,
      quantity: editedQuantity,
      unit: editedUnit,
      category: editedCategory,
    });
    setEditingId(null);
    toast({ title: "Item updated" });
  };

  const renderTable = (items: InventoryItem[], caption?: string) => (
    <Table>
      {caption && <TableCaption>{caption}</TableCaption>}
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">Name</TableHead>
          <TableHead>Quantity</TableHead>
          <TableHead>Unit</TableHead>
          {editingId && <TableHead>Category</TableHead>}
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {items.map((item) => {
          const converted = convertUnits(item.quantity, item.unit, defaultUnit);
          const showQty =
            converted !== null ? converted.toFixed(2) : item.quantity;

          return (
            <TableRow key={item.id}>
              {/* ---------------- Name ---------------- */}
              <TableCell>
                {editingId === item.id ? (
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                  />
                ) : (
                  item.name
                )}
              </TableCell>

              {/* --------------- Quantity -------------- */}
              <TableCell>
                {editingId === item.id ? (
                  <Input
                    type="number"
                    value={editedQuantity}
                    onChange={(e) =>
                      setEditedQuantity(
                        e.target.value === ""
                          ? ""
                          : parseFloat(e.target.value)
                      )
                    }
                  />
                ) : (
                  showQty
                )}
              </TableCell>

              {/* ---------------- Unit ----------------- */}
              <TableCell>
                {editingId === item.id ? (
                  <Select
                    onValueChange={setEditedUnit}
                    defaultValue={editedUnit}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {unitOptions.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : converted !== null ? (
                  defaultUnit
                ) : (
                  <>
                    {item.unit}
                    <span className="ml-1 text-xs text-muted-foreground">
                      (could not convert to {defaultUnit})
                    </span>
                  </>
                )}
              </TableCell>

              {/* -------------- Category -------------- */}
              {editingId === item.id && (
                <TableCell>
                  <Select
                    onValueChange={setEditedCategory}
                    defaultValue={editedCategory}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              )}

              {/* --------------- Actions -------------- */}
              <TableCell className="text-right">
                {editingId === item.id ? (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={saveChanges}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEditing}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEditing(item)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onDeleteItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  /* ---------------------- filtered view --------------------------- */
  const filtered = inventory.filter((i) =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  if (searchQuery) {
    return (
      <div className="overflow-x-auto">
        {renderTable(filtered, `Search results for “${searchQuery}”`)}
      </div>
    );
  }

  /* ---------------------- grouped view ---------------------------- */
/* ── grouped view ─────────────────────────────────────────────────── */
const MAIN_CATEGORIES = ["cooler", "freezer", "dry", "canned", "other"] as const;

/* 1️⃣  start with every main category present, even if empty */
const grouped: Record<(typeof MAIN_CATEGORIES)[number], InventoryItem[]> = {
  cooler: [],
  freezer: [],
  dry: [],
  canned: [],
  other: [],
};

/* 2️⃣  distribute items into the pre‑seeded buckets */
inventory.forEach((item) => {
  const main = (() => {
    if (["fruit", "vegetables", "juices", "dairy"].includes(item.category))
      return "cooler";
    if (
      [
        "meats",
        "cooked meats",
        "frozen vegetables",
        "bread",
        "desserts",
        "soups",
        "dressings",
      ].includes(item.category)
    )
      return "freezer";
    return item.category; // dry, canned, other
  })();

  grouped[main].push(item);
});

/* 3️⃣  render every main category from the constant list */
return (
  <div className="overflow-x-auto">
    <Accordion type="multiple" className="w-full">
      {MAIN_CATEGORIES.map((mainCategory) => {
        const items = grouped[mainCategory];
        const hasSub = subcategories[mainCategory].length > 0;

        return (
          <AccordionItem key={mainCategory} value={mainCategory}>
            <AccordionTrigger>
              {categoryDisplayNames[mainCategory as Category]}
            </AccordionTrigger>

            <AccordionContent>
              {hasSub ? (
                <Accordion type="single" collapsible>
                  {subcategories[mainCategory].map((sub) => {
                    const subItems = items.filter((i) => i.category === sub);

                    return (
                      <AccordionItem key={sub} value={sub}>
                        <AccordionTrigger>
                          {categoryDisplayNames[sub as Category]}
                        </AccordionTrigger>

                        <AccordionContent>
                          {subItems.length > 0 ? (
                            renderTable(
                              subItems,
                              `Your ${categoryDisplayNames[sub as Category]} inventory`
                            )
                          ) : (
                            <p className="p-4 text-sm text-muted-foreground">
                              No items in this sub‑category.
                            </p>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              ) : items.length > 0 ? (
                renderTable(
                  items,
                  `Your ${categoryDisplayNames[mainCategory as Category]} inventory`
                )
              ) : (
                <p className="p-4 text-sm text-muted-foreground">
                  No items in this category.
                </p>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  </div>
);


  return (
    <div className="overflow-x-auto">
      <Accordion type="multiple" className="w-full">
        {Object.entries(grouped).map(([mainCategory, items]) => {
          const hasSub = subcategories[mainCategory]?.length > 0;

          return (
            <AccordionItem key={mainCategory} value={mainCategory}>
              <AccordionTrigger>
                {categoryDisplayNames[mainCategory as Category]}
              </AccordionTrigger>

              <AccordionContent>
                {hasSub ? (
                  <Accordion type="single" collapsible className="w-full">
                    {subcategories[mainCategory].map((sub) => {
                      const subItems = items.filter(
                        (it) => it.category === sub
                      );
                      if (!subItems.length) return null;

                      return (
                        <AccordionItem key={sub} value={sub}>
                          <AccordionTrigger>
                            {categoryDisplayNames[sub as Category]}
                          </AccordionTrigger>
                          <AccordionContent>
                            {renderTable(
                              subItems,
                              `Your ${categoryDisplayNames[sub as Category]} inventory`
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                ) : (
                  renderTable(
                    items,
                    `Your ${categoryDisplayNames[
                      mainCategory as Category
                    ]} inventory`
                  )
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};
