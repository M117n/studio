"use client";

import React from "react";
import {
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import type {
  InventoryItem,
  Unit,
  SubCategory,
  Category,
} from "@/types/inventory";

interface EditableInventoryRowProps {
  item: InventoryItem;
  /* editing state & setters */
  editingId: string | null;
  editedName: string;
  setEditedName: React.Dispatch<React.SetStateAction<string>>;
  editedQuantity: number | "";
  setEditedQuantity: React.Dispatch<React.SetStateAction<number | "">>;
  editedUnit: Unit | undefined;
  setEditedUnit: React.Dispatch<React.SetStateAction<Unit | undefined>>;
  editedSubcategory: SubCategory | undefined;
  setEditedSubcategory: React.Dispatch<
    React.SetStateAction<SubCategory | undefined>
  >;
  /* helpers & callbacks */
  defaultUnit: Unit;
  convertUnits: (value: number, fromUnit: Unit, toUnit: Unit) => number | null;
  unitOptions: readonly Unit[];
  subcategoryOptions: readonly SubCategory[];
  startEditing: (item: InventoryItem) => void;
  saveChanges: () => void;
  cancelEditing: () => void;
  onDeleteItem: (id: string) => void;
  categoryDisplayNames: Record<Category | SubCategory, string>;
  isAdmin: boolean;
}

/** Renders one inventory row, editing or read-only. */
export const EditableInventoryRow: React.FC<EditableInventoryRowProps> = ({
  item,
  editingId,
  editedName,
  setEditedName,
  editedQuantity,
  setEditedQuantity,
  editedUnit,
  setEditedUnit,
  editedSubcategory,
  setEditedSubcategory,
  defaultUnit,
  convertUnits,
  unitOptions,
  subcategoryOptions,
  startEditing,
  saveChanges,
  cancelEditing,
  onDeleteItem,
  categoryDisplayNames,
  isAdmin,
}) => {
  const isEditing = editingId === item.id;
  const showCategoryCol = editingId !== null;
  const convertedQuantity = convertUnits(item.quantity, item.unit, defaultUnit);

  const renderQty = () =>
    convertedQuantity !== null && typeof convertedQuantity === "number"
      ? convertedQuantity.toFixed(2)
      : item.quantity;

  const renderUnit = () =>
    convertedQuantity !== null ? (
      defaultUnit
    ) : (
      <>
        {item.unit}
        <span className="ml-1 text-xs text-muted-foreground">
          (Could not convert to {defaultUnit})
        </span>
      </>
    );

  return (
    <TableRow>
      {/* -------- NAME -------- */}
      <TableCell>
        {isEditing ? (
          <Input
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            disabled={!isAdmin}
          />
        ) : (
          item.name
        )}
      </TableCell>

      {/* ----- QUANTITY ------ */}
      <TableCell>
        {isEditing ? (
          <Input
            type="number"
            value={editedQuantity}
            onChange={(e) =>
              setEditedQuantity(
                e.target.value === "" ? "" : parseFloat(e.target.value)
              )
            }
            disabled={!isAdmin}
          />
        ) : (
          renderQty()
        )}
      </TableCell>

      {/* ------- UNIT -------- */}
      <TableCell>
        {isEditing ? (
          <Select
            onValueChange={(v) => setEditedUnit(v as Unit)}
            defaultValue={editedUnit}
            disabled={isEditing && !isAdmin && !item.unit}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select a unit" />
            </SelectTrigger>
            <SelectContent>
              {unitOptions.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          renderUnit()
        )}
      </TableCell>

      {/* ---- CATEGORY (kept for alignment) ---- */}
      {showCategoryCol && (
        <TableCell>
          {isEditing ? (
            <Select
              onValueChange={(v) => setEditedSubcategory(v as SubCategory)}
              defaultValue={editedSubcategory}
              disabled={isEditing && !isAdmin && !item.subcategory}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {subcategoryOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : item.subcategory ? (
            categoryDisplayNames[item.subcategory]
          ) : (
            ""
          )}
        </TableCell>
      )}

      {/* -------- ACTIONS -------- */}
      <TableCell className="text-right">
        {isEditing ? (
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
            {isAdmin && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onDeleteItem(item.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
};
