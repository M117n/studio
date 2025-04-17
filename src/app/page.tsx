/*  src/app/page.tsx  */
/* ──────────────────────────────────────────────────────────────────── */
"use client";

import { useState, useEffect, useRef } from "react";
import { InventoryList } from "@/components/inventory/InventoryList";
import { InventoryForm } from "@/components/inventory/InventoryForm";
import { ChangeLog } from "@/components/inventory/ChangeLog";
import { CsvImportExport } from "@/components/inventory/CsvImportExport";
import { ImageToInventory } from "@/components/inventory/ImageToInventory";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings } from "lucide-react";
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
];

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

/* ------------------------------------------------------------------ */
/*  Unit‑conversion helper                                            */
/* ------------------------------------------------------------------ */

const convertUnits = (
  value: number,
  fromUnit: string,
  toUnit: string
): number | null => {
  if (fromUnit === toUnit) return value;

  const factors: Record<string, Record<string, number>> = {
    kg: { g: 1000, lb: 2.20462, oz: 35.274 },
    g: { kg: 0.001, lb: 0.00220462, oz: 0.035274 },
    lb: { kg: 0.453592, g: 453.592, oz: 16 },
    oz: { kg: 0.0283495, g: 28.3495, lb: 0.0625 },
    L: {
      mL: 1000,
      "gallon (US)": 0.264172,
      "quart (US)": 1.05669,
      "pint (US)": 2.11338,
      "fluid oz (US)": 33.814,
      "gallon (UK)": 0.219969,
      "quart (UK)": 0.879877,
      "pint (UK)": 1.75975,
      "fluid oz (UK)": 35.1951,
    },
    mL: {
      L: 0.001,
      "gallon (US)": 0.000264172,
      "quart (US)": 0.00105669,
      "pint (US)": 0.00211338,
      "fluid oz (US)": 0.033814,
      "gallon (UK)": 0.000219969,
      "quart (UK)": 0.000879877,
      "pint (UK)": 0.00175975,
      "fluid oz (UK)": 0.0351951,
    },
    "gallon (US)": {
      L: 3.78541,
      mL: 3785.41,
      "quart (US)": 4,
      "pint (US)": 8,
      "fluid oz (US)": 128,
    },
    "quart (US)": {
      L: 0.946353,
      mL: 946.353,
      "gallon (US)": 0.25,
      "pint (US)": 2,
      "fluid oz (US)": 32,
    },
    "pint (US)": {
      L: 0.473176,
      mL: 473.176,
      "gallon (US)": 0.125,
      "quart (US)": 0.5,
      "fluid oz (US)": 16,
    },
    "fluid oz (US)": {
      L: 0.0295735,
      mL: 29.5735,
      "gallon (US)": 0.0078125,
      "quart (US)": 0.03125,
      "pint (US)": 0.0625,
    },
    "gallon (UK)": {
      L: 4.54609,
      mL: 4546.09,
      "quart (UK)": 4,
      "pint (UK)": 8,
      "fluid oz (UK)": 160,
    },
    "quart (UK)": {
      L: 1.13652,
      mL: 1136.52,
      "gallon (UK)": 0.25,
      "pint (UK)": 2,
      "fluid oz (UK)": 40,
    },
    "pint (UK)": {
      L: 0.568261,
      mL: 568.261,
      "gallon (UK)": 0.125,
      "quart (UK)": 0.5,
      "fluid oz (UK)": 20,
    },
    "fluid oz (UK)": {
      L: 0.0284131,
      mL: 28.4131,
      "gallon (UK)": 0.00625,
      "quart (UK)": 0.025,
      "pint (UK)": 0.05,
    },
  };

  return factors[fromUnit]?.[toUnit]
    ? value * factors[fromUnit][toUnit]
    : null;
};

/* ------------------------------------------------------------------ */
/*  Page component                                                    */
/* ------------------------------------------------------------------ */

export default function Home() {
  /* ------------ 1.  start with SSR‑friendly defaults --------------- */
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [changeLog, setChangeLog]       = useState<string[]>([]);
  const [previousStates, setPreviousStates] = useState<InventoryItem[][]>([]);

  const [defaultUnit, setDefaultUnit]   = useState("kg");
  const [defaultCategory, setDefaultCategory] =
    useState<Category>("other");

  /* ------------ 2.  read localStorage after mount ------------------ */
  useEffect(() => {
    const inv  = localStorage.getItem("inventory");
    const log  = localStorage.getItem("changeLog");
    const unit = localStorage.getItem("defaultUnit");
    const cat  = localStorage.getItem("defaultCategory");

    if (inv)  setInventory(JSON.parse(inv));
    if (log)  setChangeLog(JSON.parse(log));
    if (unit) setDefaultUnit(unit);
    if (cat && categoryOptions.includes(cat as Category))
      setDefaultCategory(cat as Category);
  }, []);

  /* ------------ 3.  persist changes to localStorage ---------------- */
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

  /* ---------------------------------------------------------------- */
  /*  Remaining UI state & helpers (unchanged)                        */
  /* ---------------------------------------------------------------- */

  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const [longPress, setLongPress] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleLongPressStart = () => {
    setLongPress(true);
    timerRef.current = setTimeout(() => {
      setIsAlertDialogOpen(true);
      setLongPress(false);
    }, 2000);
  };
  const handleLongPressEnd = () => {
    setLongPress(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  /* ---------------- inventory CRUD helpers ------------------------ */

  const addItem = (item: Omit<InventoryItem, "id">) => {
    const idx = inventory.findIndex((i) => i.name === item.name);
    if (idx > -1) {
      /* merge into existing item */
      const existing = inventory[idx];
      if (existing.category !== item.category) {
        inventory[idx] = { ...existing, category: item.category };
      }
      const qty = convertUnits(item.quantity, item.unit, existing.unit);
      if (qty === null) {
        toast({
          variant: "destructive",
          title: "Conversion not possible",
          description: `Could not convert ${item.unit} to ${existing.unit}`,
        });
        return;
      }
      inventory[idx] = {
        ...existing,
        quantity: existing.quantity + qty,
      };
      setInventory([...inventory]);
    } else {
      setInventory([
        ...inventory,
        { ...item, id: crypto.randomUUID() },
      ]);
    }
    setPreviousStates([...previousStates, inventory]);
    setChangeLog([
      ...changeLog,
      `${new Date().toLocaleString()} - Added ${item.name}`,
    ]);
  };

  const deleteItem = (id: string) => {
    const deleted = inventory.find((i) => i.id === id);
    if (!deleted) return;
    setInventory(inventory.filter((i) => i.id !== id));
    setPreviousStates([...previousStates, inventory]);
    setChangeLog([
      ...changeLog,
      `${new Date().toLocaleString()} - Deleted ${deleted.name}`,
    ]);
  };

  const editItem = (id: string, payload: Omit<InventoryItem, "id">) => {
    const original = inventory.find((i) => i.id === id);
    if (!original) {
      toast({
        variant: "destructive",
        title: "Item not found",
      });
      return;
    }
    const qty = convertUnits(payload.quantity, payload.unit, original.unit);
    if (qty === null) {
      toast({
        variant: "destructive",
        title: "Conversion not possible",
      });
      return;
    }
    setInventory(
      inventory.map((i) =>
        i.id === id ? { ...i, ...payload, quantity: qty, unit: original.unit } : i
      )
    );
    setPreviousStates([...previousStates, inventory]);
    setChangeLog([
      ...changeLog,
      `${new Date().toLocaleString()} - Edited ${original.name}`,
    ]);
  };

  const restorePreviousState = () => {
    if (!previousStates.length) return;
    const last = previousStates[previousStates.length - 1];
    setInventory(last);
    setPreviousStates(previousStates.slice(0, -1));
    setChangeLog([
      ...changeLog,
      `${new Date().toLocaleString()} - Restored previous state`,
    ]);
  };

  const clearChangeLog = () => {
    setChangeLog([]);
    localStorage.removeItem("changeLog");
    setIsAlertDialogOpen(false);
  };

  /* ------------------------- UI ----------------------------------- */

  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">StockWatch AI</h1>

      {/*  Settings dropdown  */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="ml-auto">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="sm:w-60" align="end" forceMount>
          <div className="px-4 py-2 space-y-4">
            {/* default unit */}
            <div>
              <Label htmlFor="defaultUnit">Default Unit</Label>
              <Select
                onValueChange={setDefaultUnit}
                defaultValue={defaultUnit}
              >
                <SelectTrigger className="w-full">
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
            </div>

            {/* default category */}
            <div>
              <Label htmlFor="defaultCategory">Default Category</Label>
              <Select
                onValueChange={setDefaultCategory}
                defaultValue={defaultCategory}
              >
                <SelectTrigger className="w-full">
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
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/*  Tabs  */}
      <Tabs defaultValue="inventory" className="w-full space-y-4">
        <TabsList>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="add">Add Item</TabsTrigger>
          <TabsTrigger value="changelog">Change Log</TabsTrigger>
          <TabsTrigger value="importexport">Import / Export</TabsTrigger>
          <TabsTrigger value="image">Image to Inventory</TabsTrigger>
        </TabsList>

        {/* inventory tab */}
        <TabsContent value="inventory">
          <Card>
            <CardHeader className="flex justify-between items-center">
              <CardTitle>Current Inventory</CardTitle>
              {previousStates.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={restorePreviousState}
                >
                  Restore Previous State
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Search items…"
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

        {/* add‑item tab */}
        <TabsContent value="add">
          <Card>
            <CardHeader>
              <CardTitle>Add New Item</CardTitle>
            </CardHeader>
            <CardContent>
              <InventoryForm
                onAddItem={addItem}
                unitOptions={unitOptions}
                categoryOptions={categoryOptions}
                defaultCategory={defaultCategory}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* change‑log tab */}
        <TabsContent value="changelog">
          <Card>
            <CardHeader>
              <CardTitle>Change Log</CardTitle>
            </CardHeader>
            <CardContent>
              <ChangeLog changeLog={changeLog} />

              <AlertDialog
                open={isAlertDialogOpen}
                onOpenChange={setIsAlertDialogOpen}
              >
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
                    style={{
                      opacity: longPress ? 1 : 0.1,
                      transition: "opacity 0.5s",
                    }}
                  >
                    Clear Change Log
                  </Button>
                </AlertDialogTrigger>

                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Are you absolutely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      the change log.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={clearChangeLog}>
                      Continue
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>

        {/* import / export tab */}
        <TabsContent value="importexport">
          <Card>
            <CardHeader>
              <CardTitle>CSV Import / Export</CardTitle>
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

        {/* image‑to‑inventory tab */}
        <TabsContent value="image">
          <Card>
            <CardHeader>
              <CardTitle>Image → Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageToInventory
                onAddItem={addItem}
                defaultCategory={defaultCategory}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
