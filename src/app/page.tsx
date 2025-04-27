"use client";

import { useState, useEffect, useRef } from "react";
import { InventoryList } from "@/components/inventory/InventoryList";
import { InventoryForm } from "@/components/inventory/InventoryForm";
import { ChangeLog } from "@/components/inventory/ChangeLog";
import { CsvImportExport } from "@/components/inventory/CsvImportExport";
import { ImageToInventory } from "@/components/inventory/ImageToInventory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings } from "lucide-react";

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

const unitOptions = ["kg", "g", "L", "mL", "units", "boxes", "pieces", "lb", "oz", "gallon (US)", "quart (US)", "pint (US)", "fluid oz (US)", "gallon (UK)", "quart (UK)", "pint (UK)", "fluid oz (UK)"];

const categoryOptions: Category[] = [
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

const convertUnits = (value: number, fromUnit: string, toUnit: string): number | null => {
    if (fromUnit === toUnit) {
        return value;
    }

    // Conversion factors
    const factors: { [key: string]: { [key: string]: number } } = {
        "kg": { "g": 1000, "lb": 2.20462, "oz": 35.274 },
        "g": { "kg": 0.001, "lb": 0.00220462, "oz": 0.035274 },
        "lb": { "kg": 0.453592, "g": 453.592, "oz": 16 },
        "oz": { "kg": 0.0283495, "g": 28.3495, "lb": 0.0625 },
        "L": { "mL": 1000, "gallon (US)": 0.264172, "quart (US)": 1.05669, "pint (US)": 2.11338, "fluid oz (US)": 33.814, "gallon (UK)": 0.219969, "quart (UK)": 0.879877, "pint (UK)": 1.75975, "fluid oz (UK)": 35.1951 },
        "mL": { "L": 0.001, "gallon (US)": 0.000264172, "quart (US)": 0.00105669, "pint (US)": 0.00211338, "fluid oz (US)": 0.033814, "gallon (UK)": 0.000219969, "quart (UK)": 0.000879877, "pint (UK)": 0.00175975, "fluid oz (UK)": 0.0351951 },
        "gallon (US)": { "L": 3.78541, "mL": 3785.41, "quart (US)": 4, "pint (US)": 8, "fluid oz (US)": 128 },
        "quart (US)": { "L": 0.946353, "mL": 946.353, "gallon (US)": 0.25, "pint (US)": 2, "fluid oz (US)": 32 },
        "pint (US)": { "L": 0.473176, "mL": 473.176, "gallon (US)": 0.125, "quart (US)": 0.5, "fluid oz (US)": 16 },
        "fluid oz (US)": { "L": 0.0295735, "mL": 29.5735, "gallon (US)": 0.0078125, "quart (US)": 0.03125, "pint (US)": 0.0625 },
        "gallon (UK)": { "L": 4.54609, "mL": 4546.09, "quart (UK)": 4, "pint (UK)": 8, "fluid oz (UK)": 160 },
        "quart (UK)": { "L": 1.13652, "mL": 1136.52, "gallon (UK)": 0.25, "pint (UK)": 2, "fluid oz (UK)": 40 },
        "pint (UK)": { "L": 0.568261, "mL": 568.261, "gallon (UK)": 0.125, "quart (UK)": 0.5, "fluid oz (UK)": 20 },
        "fluid oz (UK)": { "L": 0.0284131, "mL": 28.4131, "gallon (UK)": 0.00625, "quart (UK)": 0.025, "pint (UK)": 0.05 },
    };

    if (factors[fromUnit] && factors[fromUnit][toUnit]) {
        return value * factors[fromUnit][toUnit];
    }

    // Handle cases where direct conversion is not available (e.g., kg to L)
    // You might want to add more sophisticated logic here based on the types of units
    // For now, return null to indicate that conversion is not possible
    return null;
};

export default function Home() {
    const [inventory, setInventory] = useState<InventoryItem[]>(() => {
        if (typeof window !== "undefined") {
            const storedInventory = localStorage.getItem("inventory");
            return storedInventory ? JSON.parse(storedInventory) : [];
        }
        return [];
    });

    const [changeLog, setChangeLog] = useState<string[]>(() => {
        if (typeof window !== "undefined") {
            const storedChangeLog = localStorage.getItem("changeLog");
            return storedChangeLog ? JSON.parse(storedChangeLog) : [];
        }
        return [];
    });

    const [previousStates, setPreviousStates] = useState<InventoryItem[][]>([]);

    const [defaultUnit, setDefaultUnit] = useState<string>(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("defaultUnit") || "kg";
        }
        return "kg";
    });

    const [defaultCategory, setDefaultCategory] = useState<Category>(() => {
        if (typeof window !== "undefined") {
            const storedCategory = localStorage.getItem("defaultCategory");
            return (storedCategory && categoryOptions.includes(storedCategory as Category)) ? storedCategory as Category : "other";
        }
        return "other";
    });

    useEffect(() => {
        localStorage.setItem("inventory", JSON.stringify(inventory));
    }, [inventory]);

    useEffect(() => {
        localStorage.setItem("changeLog", JSON.stringify(changeLog));
    }, [changeLog]);

    useEffect(() => {
        localStorage.setItem("defaultUnit", defaultUnit);
    }, [defaultUnit]);

    useEffect(() => {
        localStorage.setItem("defaultCategory", defaultCategory);
    }, [defaultCategory]);
    // Dark mode preference
    const [darkMode, setDarkMode] = useState<boolean>(() => {
        if (typeof window !== "undefined") {
            const storedDarkMode = localStorage.getItem("darkMode");
            return storedDarkMode === "true";
        }
        return false;
    });
    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
        if (typeof window !== "undefined") {
            localStorage.setItem("darkMode", darkMode.toString());
        }
    }, [darkMode]);

    const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
    const [longPress, setLongPress] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const handleLongPressStart = () => {
        setLongPress(true);
        timerRef.current = setTimeout(() => {
            setIsAlertDialogOpen(true);
            setLongPress(false);
        }, 2000); // Adjust the duration (in milliseconds) as needed
    };

    const handleLongPressEnd = () => {
        setLongPress(false);
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
    };

    const addItem = (item: Omit<InventoryItem, "id">) => {
        const existingItemIndex = inventory.findIndex(
            (inventoryItem) => inventoryItem.name === item.name
        );

        if (existingItemIndex > -1) {
            const existingItem = inventory[existingItemIndex];
        // Always use existing item's category when adding stock
        const existingCategory = existingItem.category;
            const convertedQuantity = convertUnits(item.quantity, item.unit, existingItem.unit);

        if (convertedQuantity !== null) {
            const updatedInventory = [...inventory];
            updatedInventory[existingItemIndex].quantity += convertedQuantity;
            setInventory(updatedInventory);
            setChangeLog([
                ...changeLog,
                `${new Date().toLocaleString()} - Added ${item.quantity} ${item.unit} (converted to ${convertedQuantity} ${existingItem.unit}) to existing item ${item.name} in category ${existingCategory}`,
            ]);
        } else {
                toast({
                    variant: "destructive",
                    title: "Conversion not possible",
                    description: `Could not convert ${item.unit} to ${existingItem.unit} for ${item.name}.`,
                });
                return;
            }
        } else {
            const newItem: InventoryItem = { ...item, id: crypto.randomUUID() };
            setInventory([...inventory, newItem]);
            setChangeLog([
                ...changeLog,
                `${new Date().toLocaleString()} - Added ${item.quantity} ${item.unit
                } of ${item.name}`,
            ]);
        }
        setPreviousStates([...previousStates, inventory]);
    };

    const deleteItem = (id: string) => {
        const deletedItem = inventory.find((item) => item.id === id);
        if (deletedItem) {
            setInventory(inventory.filter((item) => item.id !== id));
            setChangeLog([
                ...changeLog,
                `${new Date().toLocaleString()} - Deleted ${deletedItem.quantity} ${deletedItem.unit
                } of ${deletedItem.name}`,
            ]);
        }
        setPreviousStates([...previousStates, inventory]);
    };

    const editItem = (id: string, updatedItem: Omit<InventoryItem, "id">) => {
        const originalItem = inventory.find((item) => item.id === id);
        if (!originalItem) {
            toast({
                variant: "destructive",
                title: "Item not found",
                description: "The item you are trying to edit does not exist.",
            });
            return;
        }

        const convertedQuantity = convertUnits(updatedItem.quantity, updatedItem.unit, originalItem.unit);

        if (convertedQuantity === null) {
            toast({
                variant: "destructive",
                title: "Conversion not possible",
                description: `Could not convert ${updatedItem.unit} to ${originalItem.unit} for ${updatedItem.name}.`,
            });
            return;
        }

        setInventory(
            inventory.map((item) =>
                item.id === id ? { ...item, ...updatedItem, quantity: convertedQuantity, unit: originalItem.unit } : item
            )
        );

        setChangeLog([
            ...changeLog,
            `${new Date().toLocaleString()} - Edited ${originalItem.quantity} ${originalItem.unit
            } of ${originalItem.name} to ${updatedItem.quantity} ${updatedItem.unit
            } of ${updatedItem.name}`,
        ]);

        setPreviousStates([...previousStates, inventory]);
    };

    const restorePreviousState = () => {
        if (previousStates.length > 0) {
            const lastState = previousStates[previousStates.length - 1];
            setInventory(lastState);
            setPreviousStates(previousStates.slice(0, previousStates.length - 1));
            setChangeLog([
                ...changeLog,
                `${new Date().toLocaleString()} - Restored previous state`,
            ]);
        }
    };

    const clearChangeLog = () => {
        setChangeLog([]);
        localStorage.removeItem("changeLog");
        setIsAlertDialogOpen(false);
    };

    const [searchQuery, setSearchQuery] = useState("");

    // const filteredInventory = inventory.filter(item =>
    //     item.name.toLowerCase().includes(searchQuery.toLowerCase())
    // );

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">StockWatch AI</h1>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="ml-auto">
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="sm:w-60" align="end" forceMount>
                    <div className="px-4 py-2">
                        <Label htmlFor="defaultUnit" className="block text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Default Unit</Label>
                        <Select onValueChange={setDefaultUnit} defaultValue={defaultUnit}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select unit" />
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

                    <div className="px-4 py-2 flex items-center justify-between">
                        <Label htmlFor="darkMode" className="block text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Dark Mode</Label>
                        <Switch id="darkMode" checked={darkMode} onCheckedChange={setDarkMode} />
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>

            <Tabs defaultValue="inventory" className="w-full space-y-4">
                <TabsList>
                    <TabsTrigger value="inventory">Inventory</TabsTrigger>
                    <TabsTrigger value="add">Add Item</TabsTrigger>
                    <TabsTrigger value="changelog">Change Log</TabsTrigger>
                    <TabsTrigger value="importexport">Import / Export</TabsTrigger>
                    <TabsTrigger value="image">Image to Inventory</TabsTrigger>
                </TabsList>
                <TabsContent value="inventory">
                    <Card>
                        <CardHeader className="flex justify-between items-center">
                            <CardTitle>Current Inventory</CardTitle>
                            {previousStates.length > 0 && (
                                <Button size="sm" variant="outline" onClick={restorePreviousState}>
                                    Restore Previous State
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent>
                            <Input
                                type="text"
                                placeholder="Search items..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="mb-4"
                            />
                            <InventoryList
                                inventory={inventory}
                                onDeleteItem={deleteItem}
                                onEditItem={editItem}
                                defaultUnit={defaultUnit}
                                convertUnits={convertUnits}
                                searchQuery={searchQuery}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="add">
                    <Card>
                        <CardHeader>
                            <CardTitle>Add New Item</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <InventoryForm onAddItem={addItem} unitOptions={unitOptions} categoryOptions={categoryOptions} defaultCategory={defaultCategory} />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="changelog">
                    <Card>
                        <CardHeader>
                            <CardTitle>Change Log</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ChangeLog changeLog={changeLog} />
                            <AlertDialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="text-red-500 mt-4"
                                        onMouseDown={handleLongPressStart}
                                        onMouseUp={handleLongPressEnd}
                                        onMouseLeave={handleLongPressEnd}
                                        onTouchStart={handleLongPressStart}
                                        onTouchEnd={handleLongPressEnd}
                                        onTouchCancel={handleLongPressEnd}
                                        style={{ opacity: longPress ? 1 : 0.1, transition: 'opacity 0.5s' }}
                                    >
                                        Clear Change Log
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete the change log.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={clearChangeLog}>Continue</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="importexport">
                    <Card>
                        <CardHeader>
                            <CardTitle>CSV Import/Export</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CsvImportExport
                                inventory={inventory}
                                setInventory={setInventory}
                                setChangeLog={setChangeLog}
                                setPreviousStates={setPreviousStates}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="image">
                    <Card>
                        <CardHeader>
                            <CardTitle>Image to Inventory</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ImageToInventory onAddItem={addItem} defaultCategory={defaultCategory} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
