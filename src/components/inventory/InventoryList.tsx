"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

interface InventoryListProps {
  inventory: InventoryItem[];
  onDeleteItem: (id: string) => void;
  onEditItem: (id: string, updatedItem: Omit<InventoryItem, "id">) => void;
  defaultUnit: string;
  convertUnits: (value: number, fromUnit: string, toUnit: string) => number | null;
}

const unitOptions = ["kg", "g", "L", "mL", "units", "boxes", "pieces", "lb", "oz", "gallon (US)", "quart (US)", "pint (US)", "fluid oz (US)", "gallon (UK)", "quart (UK)", "pint (UK)", "fluid oz (UK)"];

export const InventoryList: React.FC<InventoryListProps> = ({
  inventory,
  onDeleteItem,
  onEditItem,
  defaultUnit,
  convertUnits,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState("");
  const [editedQuantity, setEditedQuantity] = useState<number | "">("");
  const [editedUnit, setEditedUnit] = useState("");

  const startEditing = (item: InventoryItem) => {
    setEditingId(item.id);
    setEditedName(item.name);
    setEditedQuantity(item.quantity);
    setEditedUnit(item.unit);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

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
    });
    setEditingId(null);
    toast({
      title: "Item Updated",
      description: `Item has been updated successfully.`,
    });
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableCaption>A list of your inventory items.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Name</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inventory.map((item) => {
            const convertedQuantity = convertUnits(item.quantity, item.unit, defaultUnit);
            return (
              <TableRow key={item.id}>
                <TableCell>
                  {editingId === item.id ? (
                    <Input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                    />
                  ) : (
                    item.name
                  )}
                </TableCell>
                <TableCell>
                  {editingId === item.id ? (
                    <Input
                      type="number"
                      value={editedQuantity}
                      onChange={(e) =>
                        setEditedQuantity(
                          e.target.value === "" ? "" : parseFloat(e.target.value)
                        )
                      }
                    />
                  ) : (
                    <>
                      {convertedQuantity !== null ? (
                        `${convertedQuantity.toFixed(2)}`
                      ) : (
                        `${item.quantity}`
                      )}
                    </>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === item.id ? (
                    <Select onValueChange={setEditedUnit} defaultValue={editedUnit}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select a unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {unitOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <>
                      {convertedQuantity !== null ? (
                        `${defaultUnit}`
                      ) : (
                        <>
                          {item.unit}
                          <span className="ml-1 text-xs text-muted-foreground">
                            (Could not convert to {defaultUnit})
                          </span>
                        </>
                      )}
                    </>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editingId === item.id ? (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={saveChanges}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={cancelEditing}
                      >
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
    </div>
  );
};
