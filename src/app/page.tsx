"use client";

import { useState, useEffect, useRef, useCallback } from "react";;
import { InventoryList } from "@/components/inventory/InventoryList";
import { InventoryForm } from "@/components/inventory/InventoryForm";
import { ChangeLog } from "@/components/inventory/ChangeLog";
import { CsvImportExport } from "@/components/inventory/CsvImportExport";
import { ImageToInventory } from "@/components/inventory/ImageToInventory";
import type { InventoryItem, Category, Unit, SubCategory } from "@/types/inventory";
import { SUBCATEGORY_OPTIONS, CATEGORY_OPTIONS, UNIT_OPTIONS } from "@/types/inventory";
import { convertUnits } from "@/lib/unitConversion";
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
import { AuthPanel } from '@/components/AuthPanel';

// Key for offline operation queue in localStorage
const QUEUE_KEY = "inventorySyncQueue";

// Enqueue an inventory operation (add/update/delete) for later sync
function enqueueOp(op: any) {
  if (typeof window === "undefined") return;
  const qRaw = localStorage.getItem(QUEUE_KEY);
  const queue = qRaw ? JSON.parse(qRaw) : [];
  queue.push(op);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

const categoryOptions = CATEGORY_OPTIONS;
const subcategoryOptions = SUBCATEGORY_OPTIONS;
const unitOptions     = UNIT_OPTIONS;


        
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

    const [defaultUnit, setDefaultUnit] = useState<Unit>(() => {
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem("defaultUnit");
          return stored && UNIT_OPTIONS.includes(stored as Unit)
            ? (stored as Unit)
            : "kg";
        }
        return "kg";
      });

    const [defaultCategory, setDefaultCategory] = useState<Category>(() => {
          if (typeof window !== "undefined") {
            const stored = localStorage.getItem("defaultCategory");
            return stored && categoryOptions.includes(stored as Category)
              ? (stored as Category)
              : "other";
          }
          return "other";
        });
    
    const [defaultSubcategory, setDefaultSubcategory] = useState<SubCategory>(() => {
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem("defaultSubCategory");
          return stored && subcategoryOptions.includes(stored as SubCategory)
            ? (stored as SubCategory)
            : "other";
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
    
    // Fetch inventory from server on mount (if online)
    useEffect(() => {
        if (!navigator.onLine) return;
        async function fetchServer() {
            try {
                const res = await fetch("/api/inventory");
                if (res.ok) {
                    const data = await res.json();
                    setInventory(data);
                }
            } catch (e) {
                console.error("Failed to fetch server inventory", e);
            }
        }
        fetchServer();
    }, []);

    // ---------- Process offline queue ----------
    const processQueue = useCallback(async () => {
            if (!navigator.onLine) return;
    
            const qRaw = localStorage.getItem(QUEUE_KEY);
            const queue: any[] = qRaw ? JSON.parse(qRaw) : [];
            const newQueue: any[] = [];
    
            for (const op of queue) {
                try {
                    if (op.type === "add") {
                        await fetch("/api/inventory", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(op.item),
                        });
                    } else if (op.type === "update") {
                        await fetch(`/api/inventory/${op.id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(op.data),
                        });
                    } else if (op.type === "delete") {
                        await fetch(`/api/inventory/${op.id}`, { method: "DELETE" });
                    }
                } catch {
                    newQueue.push(op);   // si falla, vuelve a la cola
                }
            }
    
            localStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
    
            // Trae inventario fresco del servidor
            try {
                const res = await fetch("/api/inventory");
                if (res.ok) {
                    const data = await res.json();
                    setInventory(data);
                }
            } catch (e) {
                console.error("Failed to refresh inventory:", e);
            }
        }, []);   // ← sin dependencias: misma referencia siempre
    
        useEffect(() => {
            // 1) Procesar cola inmediatamente si estamos online
            processQueue();
            // 2) Volver a procesarla cada vez que recuperamos conexión
            window.addEventListener("online", processQueue);
            return () => window.removeEventListener("online", processQueue);
        }, [processQueue]);   // ← solo depende de la función memorizada
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
        // Enqueue operation for server sync
        if (existingItemIndex > -1) {
          // Update existing item on server
          const updatedQty = inventory[existingItemIndex].quantity +
            (convertUnits(item.quantity, item.unit, inventory[existingItemIndex].unit) || 0);
          enqueueOp({
            type: "update",
            id: inventory[existingItemIndex].id,
            data: {
              name: inventory[existingItemIndex].name,
              quantity: updatedQty,
              unit: inventory[existingItemIndex].unit,
              category: inventory[existingItemIndex].category,
              subcategory: inventory[existingItemIndex].subcategory,
            },
          });
        } else {
          // Add new item to server
          enqueueOp({ type: "add", item });
        }
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
        // Enqueue delete operation for server sync
        enqueueOp({ type: "delete", id });
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
        // Enqueue update operation for server sync
        enqueueOp({
          type: "update",
          id,
          data: {
            name: updatedItem.name,
            quantity: convertedQuantity,
            unit: originalItem.unit,
            category: updatedItem.category,
            subcategory: updatedItem.subcategory,
          },
        });
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
            <h1 className="text-2xl font-bold mb-4">Shawinv</h1>
            {/* 🔐 Auth UI - Login/Register */}
            <div className="mb-6">
                <AuthPanel />
            </div>
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
                        <Select onValueChange={(v) => setDefaultUnit(v as Unit)} defaultValue={defaultUnit}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select unit" />
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
                            <InventoryForm onAddItem={addItem} unitOptions={UNIT_OPTIONS} subcategoryOptions={SUBCATEGORY_OPTIONS} defaultSubcategory={defaultSubcategory} />
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
                            <ImageToInventory onAddItem={addItem} defaultSubcategory={defaultSubcategory} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
