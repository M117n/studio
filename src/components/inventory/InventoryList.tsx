"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMainCategory } from "@/types/inventory";
import type { InventoryItem, Category, Unit, SubCategory } from "@/types/inventory";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


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

// We don't need to redefine these as they're passed as props

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
    const [editedUnit, setEditedUnit] = useState<Unit>(unitOptions[0]);
    const [editedSubcategory, setEditedSubcategory] = useState<SubCategory>(subcategoryOptions[0]); // Default category

    const filteredInventory = inventory.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const startEditing = (item: InventoryItem) => {
        setEditingId(item.id);
        setEditedName(item.name);
        setEditedQuantity(item.quantity);
        setEditedUnit(item.unit);
        setEditedSubcategory(item.subcategory || subcategoryOptions[0]);
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
            subcategory: editedSubcategory,
            category: getMainCategory(editedSubcategory),
        });
        setEditingId(null);
        toast({
            title: "Item Updated",
            description: `Item has been updated successfully.`,
        });
    };

    // Dynamically group inventory items by their category
    const groupedInventory: Record<string, InventoryItem[]> = {};
    for (const item of inventory) {
        const mainCategory = item.category || 'other';
        if (!groupedInventory[mainCategory]) groupedInventory[mainCategory] = [];
        groupedInventory[mainCategory].push(item);
    }
    const sortedCategories = Object.keys(groupedInventory).sort((a, b) => a.localeCompare(b));

    // Get subcategories by category from the subcategoryOptions prop
    const subcategories = subcategoryOptions.reduce<{ [key in Category]: SubCategory[] }>(
        (acc, subcategory) => {
            const category = getMainCategory(subcategory);
            if (!acc[category]) {
                acc[category] = [];
            }
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
                                                {convertedQuantity !== null && typeof convertedQuantity === 'number' ? (
                                                    `${convertedQuantity.toFixed(2)}`
                                                ) : (
                                                    `${item.quantity}`
                                                )}
                                            </>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {editingId === item.id ? (
                                            <Select onValueChange={(v) => setEditedUnit(v as Unit)} defaultValue={editedUnit}>
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
                                            <Select onValueChange={(v) => setEditedSubcategory(v as SubCategory)} defaultValue={editedSubcategory}>
                                                <SelectTrigger className="w-[180px]">
                                                    <SelectValue placeholder="Select a category" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {(subcategoryOptions as Category[]).map((option) => (
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
                <Accordion type="multiple">
                    {Object.entries(groupedInventory).map(([mainCategory, items]) => {
                        const hasSubcategories = (subcategories[mainCategory as keyof typeof subcategories] ?? []).length > 0;
                        return (
                            <AccordionItem key={mainCategory} value={mainCategory}>
                                <AccordionTrigger>{categoryDisplayNames[mainCategory as SubCategory]}</AccordionTrigger>
                                <AccordionContent>
                                    {hasSubcategories ? (
                                        <Accordion type="multiple">
                                            {subcategories[mainCategory as keyof typeof subcategories].map(subcategory => {
                                                const subcategoryItems = items.filter(item => item.subcategory === subcategory);
                                                if (subcategoryItems.length === 0) {
                                                    return null;
                                                }
                                                return (
                                                    <AccordionItem key={subcategory} value={subcategory}>
                                                        <AccordionTrigger>{categoryDisplayNames[subcategory as SubCategory]}</AccordionTrigger>
                                                        <AccordionContent>
                                                            <Table>
                                                                <TableCaption>A list of your {categoryDisplayNames[subcategory as SubCategory]} inventory items.</TableCaption>
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
                                                                    {subcategoryItems.map(item => {
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
                                                                                        <Select onValueChange={(v) => setEditedUnit(v as Unit)} defaultValue={editedUnit}>
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
                                                                                        <Select onValueChange={(v) => setEditedSubcategory(v as SubCategory)} defaultValue={editedSubcategory}>
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
                                        {/* START: Add table for leftover items (Moved here) */}
                                        {(() => {
                                            const mainCategorySubcategories = subcategories[mainCategory as keyof typeof subcategories] || [];
                                            // Filter for items that are in the current mainCategory but not in any of its defined subcategories
                                            const leftoverItems = items.filter(item => {
                                                // Check if the item's subcategory is null/undefined OR not in the list of mainCategorySubcategories
                                                return !item.subcategory || !mainCategorySubcategories.includes(item.subcategory);
                                            });

                                            if (leftoverItems.length > 0) {
                                                return (
                                                    <>
                                                        <h4 className="text-lg font-semibold mt-4 mb-2">
                                                            Other items in {categoryDisplayNames[mainCategory as SubCategory] || mainCategory}
                                                        </h4>
                                                        <Table>
                                                            <TableCaption>A list of other {categoryDisplayNames[mainCategory as SubCategory] || mainCategory} inventory items.</TableCaption>
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
                                                                {leftoverItems.map(item => {
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
                                                                                        {convertedQuantity !== null && typeof convertedQuantity === 'number' ? (
                                                                                            `${convertedQuantity.toFixed(2)}`
                                                                                        ) : (
                                                                                            `${item.quantity}`
                                                                                        )}
                                                                                    </>
                                                                                )}
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                {editingId === item.id ? (
                                                                                    <Select onValueChange={(v) => setEditedUnit(v as Unit)} defaultValue={editedUnit}>
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
                                                                                    <Select onValueChange={(v) => setEditedSubcategory(v as SubCategory)} defaultValue={editedSubcategory}>
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
                                                    </>
                                                );
                                            }
                                            return null;
                                        })()}
                                        {/* END: Add table for leftover items */}
                                    ) : (
                                        // This is the case where hasSubcategories is false
                                        // Items are displayed directly in a single table
                                        <Table>
                                            <TableCaption>A list of your {categoryDisplayNames[mainCategory as SubCategory]} inventory items.</TableCaption>
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
                                                {items.map(item => {
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
                                                                        {convertedQuantity !== null && typeof convertedQuantity === 'number' ? (
                                                                            `${convertedQuantity.toFixed(2)}`
                                                                        ) : (
                                                                            `${item.quantity}`
                                                                        )}
                                                                    </>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                {editingId === item.id ? (
                                                                    <Select onValueChange={(v) => setEditedUnit(v as Unit)} defaultValue={editedUnit}>
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
                                                                    <Select onValueChange={(v) => setEditedSubcategory(v as SubCategory)} defaultValue={editedSubcategory}>
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
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        );
                    })}
                </Accordion>
            )}
        </div>
    );
};
