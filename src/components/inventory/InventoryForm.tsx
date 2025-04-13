"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface InventoryFormProps {
  onAddItem: (item: { name: string; quantity: number; unit: string }) => void;
}

const unitOptions = ["kg", "g", "L", "mL", "units", "boxes", "pieces"];

export const InventoryForm: React.FC<InventoryFormProps> = ({
  onAddItem,
}) => {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [unit, setUnit] = useState(unitOptions[0]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!name || quantity === "" || !unit) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields.",
      });
      return;
    }

    if (typeof quantity === "string" || isNaN(quantity)) {
      toast({
        variant: "destructive",
        title: "Invalid quantity",
        description: "Quantity must be a number.",
      });
      return;
    }

    onAddItem({ name, quantity, unit });
    setName("");
    setQuantity("");
    setUnit(unitOptions[0]);
    toast({
      title: "Item Added",
      description: `Added ${quantity} ${unit} of ${name} to inventory.`,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Item Name"
        />
      </div>
      <div>
        <Label htmlFor="quantity">Quantity</Label>
        <Input
          type="number"
          id="quantity"
          value={quantity}
          onChange={(e) =>
            setQuantity(e.target.value === "" ? "" : parseFloat(e.target.value))
          }
          placeholder="Quantity"
        />
      </div>
      <div>
        <Label htmlFor="unit">Unit</Label>
        <Select onValueChange={setUnit} defaultValue={unit}>
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
      </div>
      <Button type="submit">Add Item</Button>
    </form>
  );
};
