"use client";

import { useState } from "react";
import { getMainCategory } from "@/types/inventory";
import type {
  InventoryItem,
  Category,
  Unit,
  SubCategory,
} from "@/types/inventory";
import {
  Table,
  TableBody,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import React from "react";
import { EditableInventoryRow } from "@/components/inventory/EditableInventoryRow";

interface InventoryListProps {
  inventory: InventoryItem[];
  onDeleteItem: (id: string) => void;
  onEditItem: (id: string, updatedItem: Omit<InventoryItem, "id">) => void;
  defaultUnit: Unit;
  convertUnits: (value: number, fromUnit: Unit, toUnit: Unit) => number | null;
  searchQuery: string;
  subcategoryOptions: readonly SubCategory[];
  unitOptions: readonly Unit[];
}

export const InventoryList: React.FC<InventoryListProps> = ({
  inventory,
  onDeleteItem,
  onEditItem,
  defaultUnit,
  convertUnits,
  searchQuery,
  subcategoryOptions,
  unitOptions,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState("");
  const [editedQuantity, setEditedQuantity] = useState<number | "">("");
  const [editedUnit, setEditedUnit] = useState<Unit | undefined>(
    unitOptions.length > 0 ? unitOptions[0] : undefined
  );
  const [editedSubcategory, setEditedSubcategory] = useState<
    SubCategory | undefined
  >(subcategoryOptions.length > 0 ? subcategoryOptions[0] : undefined);

  const filteredInventory = inventory.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startEditing = (item: InventoryItem) => {
    setEditingId(item.id);
    setEditedName(item.name);
    setEditedQuantity(item.quantity);
    setEditedUnit(item.unit);
    // safe fallback when subcategoryOptions might be empty
    setEditedSubcategory(
      item.subcategory ?? (subcategoryOptions.length > 0 ? subcategoryOptions[0] : undefined)
    );
  };
  

  const cancelEditing = () => {
    setEditingId(null);
  };

  const saveChanges = () => {
    if (!editingId) return;

    if (!editedName || editedQuantity === "" || !editedUnit) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields: Name, Quantity, and Unit.",
      });
      return;
    }

    const finalQuantity = parseFloat(String(editedQuantity));
    if (isNaN(finalQuantity)) {
      toast({
        variant: "destructive",
        title: "Invalid quantity",
        description: "Quantity must be a valid number.",
      });
      return;
    }

    onEditItem(editingId, {
      name: editedName,
      quantity: finalQuantity,
      unit: editedUnit,
      subcategory: editedSubcategory,
      category: editedSubcategory ? getMainCategory(editedSubcategory) : "other",
    });
    setEditingId(null);
    toast({
      title: "Item Updated",
      description: "Item has been updated successfully.",
    });
  };

  /* ---------------- data helpers ---------------- */

  // Group items by main category
  const groupedInventory: Record<string, InventoryItem[]> = {};
  for (const item of inventory) {
    const mainCategory = item.category || "other";
    if (!groupedInventory[mainCategory]) groupedInventory[mainCategory] = [];
    groupedInventory[mainCategory].push(item);
  }
  const sortedCategories = Object.keys(groupedInventory).sort((a, b) =>
    a.localeCompare(b)
  );

  // Map subcategories → main category
  const subcategories = subcategoryOptions.reduce<
    { [key in Category]: SubCategory[] }
  >(
    (acc, subcategory) => {
      const category = getMainCategory(subcategory);
      if (!acc[category]) acc[category] = [];
      acc[category].push(subcategory);
      return acc;
    },
    { cooler: [], freezer: [], dry: [], canned: [], other: [] }
  );

  const categoryDisplayNames: Record<Category | SubCategory, string> = {
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

  /* -------------- rendering helpers -------------- */

  const displayName = (key: Category | SubCategory) =>
    categoryDisplayNames[key] ?? key;

  const renderQuantity = (
    quantity: number,
    unit: Unit,
    convertedQuantity: number | null
  ) =>
    convertedQuantity !== null && typeof convertedQuantity === "number"
      ? convertedQuantity.toFixed(2)
      : quantity;

  const renderUnit = (unit: Unit, convertedQuantity: number | null) =>
    convertedQuantity !== null ? (
      defaultUnit
    ) : (
      <>
        {unit}
        <span className="ml-1 text-xs text-muted-foreground">
          (Could not convert to {defaultUnit})
        </span>
      </>
    );

  /* -------------------- JSX --------------------- */

  return (
    <div className="overflow-x-auto">
      {searchQuery ? (
        /* ----------- SEARCH RESULTS TABLE ----------- */
        <Table>
          <TableCaption>Search results for "{searchQuery}"</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Name</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Unit</TableHead>
              {editingId !== null && <TableHead>Category</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInventory.map((item) => (
              <EditableInventoryRow
                key={item.id}
                item={item}
                /* state */
                editingId={editingId}
                editedName={editedName}
                setEditedName={setEditedName}
                editedQuantity={editedQuantity}
                setEditedQuantity={setEditedQuantity}
                editedUnit={editedUnit}
                setEditedUnit={setEditedUnit}
                editedSubcategory={editedSubcategory}
                setEditedSubcategory={setEditedSubcategory}
                /* helpers & callbacks */
                defaultUnit={defaultUnit}
                convertUnits={convertUnits}
                unitOptions={unitOptions}
                subcategoryOptions={subcategoryOptions}
                startEditing={startEditing}
                saveChanges={saveChanges}
                cancelEditing={cancelEditing}
                onDeleteItem={onDeleteItem}
                categoryDisplayNames={categoryDisplayNames}
              />
            ))}
          </TableBody>

        </Table>
      ) : (
        /* -------------- ACCORDION VIEW -------------- */
        <Accordion type="multiple">
          {sortedCategories.map((mainCategory) => {
            const items = groupedInventory[mainCategory];
            const mainSubcats =
              subcategories[mainCategory as keyof typeof subcategories] || [];
            const hasSubcategories = mainSubcats.length > 0;

            return (
              <AccordionItem key={mainCategory} value={mainCategory}>
                {/* ⬇️  ⬇️  Fix: remove unnecessary `as SubCategory` assertion */}
                <AccordionTrigger>{displayName(mainCategory as Category)}</AccordionTrigger>
                <AccordionContent>
                  {hasSubcategories ? (
                    /* sub-accordion */
                    <Accordion type="multiple">
                      {mainSubcats.map((subcat) => {
                        const subItems = items.filter(
                          (i) => i.subcategory === subcat
                        );
                        if (subItems.length === 0) return null;
                        return (
                          <AccordionItem key={subcat} value={subcat}>
                            <AccordionTrigger>{displayName(subcat)}</AccordionTrigger>
                            <AccordionContent>{renderTable(subItems, subcat)}</AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  ) : (
                    /* no subcategories */
                    renderTable(items, mainCategory as SubCategory)
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );

  /* ---------- helper: render category table ---------- */
  function renderTable(items: InventoryItem[], captionKey: SubCategory | Category) {
    return (
      <Table>
        <TableCaption>
          A list of your {categoryDisplayNames[captionKey]} inventory items.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Name</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Unit</TableHead>
            {editingId !== null && <TableHead>Category</TableHead>}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <EditableInventoryRow
              key={item.id}
              item={item}
              /* same prop bundle as above */
              editingId={editingId}
              editedName={editedName}
              setEditedName={setEditedName}
              editedQuantity={editedQuantity}
              setEditedQuantity={setEditedQuantity}
              editedUnit={editedUnit}
              setEditedUnit={setEditedUnit}
              editedSubcategory={editedSubcategory}
              setEditedSubcategory={setEditedSubcategory}
              defaultUnit={defaultUnit}
              convertUnits={convertUnits}
              unitOptions={unitOptions}
              subcategoryOptions={subcategoryOptions}
              startEditing={startEditing}
              saveChanges={saveChanges}
              cancelEditing={cancelEditing}
              onDeleteItem={onDeleteItem}
              categoryDisplayNames={categoryDisplayNames}
            />
          ))}
        </TableBody>

      </Table>
    );
  }
};