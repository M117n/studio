"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { InventoryItemData, AppSpecificUnit, SubCategory } from "@/types/inventory";
import { getMainCategory } from "@/types/inventory";
import { on } from "events";

interface InventoryFormProps {
    onAddItem: (item: InventoryItemData) => void;
    unitOptions: readonly AppSpecificUnit[];
    subcategoryOptions: readonly SubCategory[];
    defaultSubcategory: SubCategory;
}

export const InventoryForm: React.FC<InventoryFormProps> = ({
    onAddItem,
    unitOptions,
    subcategoryOptions,
    defaultSubcategory,
}) => {
    const [name, setName] = useState("");
    const [quantity, setQuantity] = useState<number | "">("");
    const [unit, setUnit] = useState<AppSpecificUnit>(unitOptions[0]);
    const [subcategory, setSubcategory] = useState<SubCategory>(defaultSubcategory);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();

        if (!name || quantity === "" || !unit || !subcategory) {
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

        onAddItem({ name, quantity, unit, subcategory, category: getMainCategory(subcategory) });
        setName("");
        setQuantity("");
        setUnit(unitOptions[0]);
        setSubcategory(defaultSubcategory);
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
                <Select onValueChange={(v) => setUnit(v as AppSpecificUnit)} defaultValue={unitOptions[0]}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select a unit" />
                    </SelectTrigger>
                    <SelectContent>
                        {unitOptions.map((option: string) => (
                            <SelectItem key={option} value={option}>
                                {option}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor="category">Category</Label>
                <Select onValueChange={(v) => setSubcategory(v as SubCategory)} defaultValue={defaultSubcategory}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                        {subcategoryOptions.map((option: SubCategory) => (
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
