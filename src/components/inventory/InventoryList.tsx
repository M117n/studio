"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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
    onEditItem: (id: string, updatedItem: Omit<InventoryItem, "id">) => void;
    defaultUnit: string;
    convertUnits: (value: number, fromUnit: string, toUnit: string) => number | null;
    searchQuery: string;
}

const unitOptions = ["kg", "g", "L", "mL", "units", "boxes", "pieces", "lb", "oz", "gallon (US)", "quart (US)", "pint (US)", "fluid oz (US)", "gallon (UK)", "quart (UK)", "pint (UK)", "fluid oz (UK)"];

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

export const InventoryList: React.FC<InventoryListProps> = ({
    inventory,
    onDeleteItem,
    onEditItem,
    defaultUnit,
    convertUnits,
    searchQuery,
}) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editedName, setEditedName] = useState("");
    const [editedQuantity, setEditedQuantity] = useState<number | "">("");
    const [editedUnit, setEditedUnit] = useState("");
    const [editedCategory, setEditedCategory] = useState<Category>("other"); // Default category

    const filteredInventory = inventory.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const startEditing = (item: InventoryItem) => {
        setEditingId(item.id);
        setEditedName(item.name);
        setEditedQuantity(item.quantity);
        setEditedUnit(item.unit);
        setEditedCategory(item.category);
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
            category: editedCategory,
        });
        setEditingId(null);
        toast({
            title: "Item Updated",
            description: `Item has been updated successfully.`,
        });
    };

    // Group inventory items by category
    const groupedInventory = filteredInventory.reduce((acc: { [key in Category]: InventoryItem[] }, item) => {
        const mainCategory = getMainCategory(item.category);
        if (!acc[mainCategory]) {
            acc[mainCategory] = [];
        }
        acc[mainCategory].push(item);
        return acc;
    }, {
        cooler: [],
        freezer: [],
        dry: [],
        canned: [],
        other: [],
        fruit: [],
        vegetables: [],
        juices: [],
        dairy: [],
        meats: [],
        "cooked meats": [],
        "frozen vegetables": [],
        bread: [],
        desserts: [],
        soups: [],
        dressings: [],
    });

    const categoryDisplayNames: { [key in Category]: string } = {
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

    function getMainCategory(category: Category): Category {
        if (["fruit", "vegetables", "juices", "dairy"].includes(category)) {
            return "cooler";
        } else if (["meats", "cooked meats", "frozen vegetables", "bread", "desserts", "soups", "dressings"].includes(category)) {
            return "freezer";
        } else if (category === "dry") {
            return "dry";
        } else if (category === "canned") {
            return "canned";
        } else {
            return "other";
        }
    }

    return (
        <div className="overflow-x-auto">
            {searchQuery ? (
                <Table>
                    <TableCaption>Search results for "{searchQuery}"</TableCaption>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]">Name</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Unit</TableHead>
                            {editingId === null ? null : (
                                <TableHead>Category</TableHead>
                            )}
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredInventory.map((item) => {
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
                                    {editingId === item.id ? (
                                        <TableCell>
                                            <Select onValueChange={setEditedCategory} defaultValue={editedCategory}>
                                                <SelectTrigger className="w-[180px]">
                                                    <SelectValue placeholder="Select a category" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {categoryOptions.map((option) => (
                                                        <SelectItem key={option} value={option}>
                                                            {option}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                    ) : null}

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
            ) : (
                <Accordion type="single" collapsible>
                    {Object.entries(groupedInventory).map(([category, items]) => {
                        if (category === "fruit" || category === "vegetables" || category === "juices" || category === "dairy" || category === "meats" || category === "cooked meats" || category === "frozen vegetables" || category === "bread" || category === "desserts" || category === "soups" || category === "dressings") {
                            return null; // Skip rendering subcategories directly
                        }

                        return (
                            <AccordionItem key={category} value={category}>
                                <AccordionTrigger>{categoryDisplayNames[category as Category]}</AccordionTrigger>
                                <AccordionContent>
                                    <Table>
                                        <TableCaption>A list of your {categoryDisplayNames[category as Category]} inventory items.</TableCaption>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[100px]">Name</TableHead>
                                                <TableHead>Quantity</TableHead>
                                                <TableHead>Unit</TableHead>
                                                {editingId === null ? null : (
                                                    <TableHead>Category</TableHead>
                                                )}
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {items.map((item) => {
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
                                                        {editingId === item.id ? (
                                                            <TableCell>
                                                                <Select onValueChange={setEditedCategory} defaultValue={editedCategory}>
                                                                    <SelectTrigger className="w-[180px]">
                                                                        <SelectValue placeholder="Select a category" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {categoryOptions.map((option) => (
                                                                            <SelectItem key={option} value={option}>
                                                                                {option}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </TableCell>
                                                        ) : null}

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
                                </AccordionContent>
                            </AccordionItem>
                        );
                    })}
                </Accordion>
            )}
        </div>
    );
};
