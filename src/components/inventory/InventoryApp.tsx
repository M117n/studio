// components/inventory/InventoryApp.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { InventoryList } from "@/components/inventory/InventoryList";
import { InventoryForm } from "@/components/inventory/InventoryForm";
import { ChangeLog } from "@/components/inventory/ChangeLog";
import { CsvImportExport } from "@/components/inventory/CsvImportExport";
import { ImageToInventory } from "@/components/inventory/ImageToInventory";
import type {
  InventoryItem,
  Category,
  Unit,
  SubCategory,
} from "@/types/inventory";
import {
  SUBCATEGORY_OPTIONS,
  CATEGORY_OPTIONS,
  UNIT_OPTIONS,
} from "@/types/inventory";
import { convertUnits } from "@/lib/unitConversion";

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
import { toast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
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
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Settings, LogOut, RotateCcw } from "lucide-react";
import { auth } from "@/lib/firebaseClient";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                    */
/* ------------------------------------------------------------------ */

/** Local‑storage key that queues offline ops for later sync */
const QUEUE_KEY = "inventorySyncQueue";

function enqueueOp(op: unknown) {
  if (typeof window === "undefined") return;
  const qRaw = localStorage.getItem(QUEUE_KEY);
  const queue = qRaw ? JSON.parse(qRaw) : [];
  queue.push(op);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

const categoryOptions = CATEGORY_OPTIONS;
const subcategoryOptions = SUBCATEGORY_OPTIONS;
const unitOptions = UNIT_OPTIONS;

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export default function InventoryApp() {
  /* ----------------------------- state ---------------------------- */
  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("inventory");
      return stored ? JSON.parse(stored) : [];
    }
    return [];
  });

  const [changeLog, setChangeLog] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("changeLog");
      return stored ? JSON.parse(stored) : [];
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

  const [defaultSubcategory, setDefaultSubcategory] = useState<SubCategory>(
    () => {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("defaultSubCategory");
        return stored && subcategoryOptions.includes(stored as SubCategory)
          ? (stored as SubCategory)
          : "other";
      }
      return "other";
    },
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const [subtractMode, setSubtractMode] = useState(false);

  /* ----------------------------- refs ----------------------------- */
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* -----------------------------logout ----------------------------- */
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/sessionLogout", { method: "POST" });
    await signOut(auth);              // clear client‑side Firebase session
    router.replace("/");              // go back to the auth page
  };

  /* --------------------------- persistence ------------------------ */
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
    localStorage.setItem("defaultSubCategory", defaultSubcategory);
  }, [defaultSubcategory]);

  /* --------------------------- networking ------------------------- */
  /** Sync queued operations when back online */
  const processQueue = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.onLine) return;

    const qRaw = localStorage.getItem(QUEUE_KEY);
    if (!qRaw) return;
    const queue: any[] = JSON.parse(qRaw);
    if (!queue.length) return;

    try {
      for (const op of queue) {
        await fetch("/api/inventory", {
          method: op.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(op.body),
        });
      }
      localStorage.removeItem(QUEUE_KEY);
      toast({ title: "Offline changes synced." });
    } catch (err) {
      console.error("Sync failed, keeping queue:", err);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("online", processQueue);
    processQueue();
    return () => window.removeEventListener("online", processQueue);
  }, [processQueue]);

  /** Initial load / refresh from server */
  useEffect(() => {
    async function fetchServer() {
      try {
        const res = await fetch("/api/inventory");
        if (res.ok) {
          const data: InventoryItem[] = await res.json();
          setInventory((prev) => {
            const merged = new Map<string, InventoryItem>();
            data.forEach((item) => merged.set(item.id, item));
            prev.forEach((item) => {
              if (!merged.has(item.id)) merged.set(item.id, item);
            });
            return Array.from(merged.values());
          });
        }
      } catch (e) {
        console.error("Failed to fetch inventory:", e);
      }
    }
    fetchServer();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (darkMode) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, [darkMode]);

  /* --------------------------- handlers --------------------------- */
  /** Add or merge an item */
  const addItem = (item: Omit<InventoryItem, "id">) => {
    const existingIdx = inventory.findIndex((i) => i.name === item.name);
    if (existingIdx > -1) {
      const existing = inventory[existingIdx];
      const converted = convertUnits(item.quantity, item.unit, existing.unit);
      if (converted === null) {
        toast({
          variant: "destructive",
          title: "Conversion not possible",
          description: `Cannot convert ${item.unit} to ${existing.unit}.`,
        });
        return;
      }
      const updated = [...inventory];
      updated[existingIdx].quantity += converted;
      setInventory(updated);
      setChangeLog([
        ...changeLog,
        `${new Date().toLocaleString()} - Added ${item.quantity} ${item.unit} (converted to ${converted} ${existing.unit}) to ${item.name}.`,
      ]);
      enqueueOp({
        method: "PUT",
        body: { id: existing.id, quantity: updated[existingIdx].quantity },
      });
    } else {
      const newItem: InventoryItem = { ...item, id: crypto.randomUUID() };
      setInventory([...inventory, newItem]);
      setChangeLog([
        ...changeLog,
        `${new Date().toLocaleString()} - Added ${item.quantity} ${item.unit} of ${item.name}.`,
      ]);
      enqueueOp({ method: "POST", body: newItem });
    }
  };

  /** Edit an existing item */
  const editItem = (id: string, updated: Partial<InventoryItem>) => {
    const idx = inventory.findIndex((i) => i.id === id);
    if (idx === -1) {
      toast({
        variant: "destructive",
        title: "Item not found",
        description: "The item you are trying to edit does not exist.",
      });
      return;
    }

    const original = inventory[idx];
    const converted = convertUnits(
      updated.quantity ?? original.quantity,
      updated.unit ?? original.unit,
      original.unit,
    );
    if (converted === null) {
      toast({
        variant: "destructive",
        title: "Conversion not possible",
        description: `Cannot convert units for ${original.name}.`,
      });
      return;
    }

    const next = [...inventory];
    next[idx] = {
      ...original,
      ...updated,
      quantity: converted,
      unit: original.unit,
    };
    setPreviousStates([...previousStates, inventory]);
    setInventory(next);
    setChangeLog([
      ...changeLog,
      `${new Date().toLocaleString()} - Edited ${original.name}.`,
    ]);
    enqueueOp({ method: "PUT", body: next[idx] });
  };

  /** Delete an item */
  const deleteItem = (id: string) => {
    const target = inventory.find((i) => i.id === id);
    if (!target) return;
    setPreviousStates([...previousStates, inventory]);
    setInventory(inventory.filter((i) => i.id !== id));
    setChangeLog([
      ...changeLog,
      `${new Date().toLocaleString()} - Deleted ${target.name}.`,
    ]);
    enqueueOp({ method: "DELETE", body: { id } });
  };

  /** Undo last change */
  const undoLastChange = () => {
    if (!previousStates.length) return;
    const prev = previousStates[previousStates.length - 1];
    setPreviousStates(previousStates.slice(0, -1));
    setInventory(prev);
    setChangeLog([
      ...changeLog,
      `${new Date().toLocaleString()} - Undo last change.`,
    ]);
  };

  /* ----------------------------- UI ------------------------------ */
  return (
    <div className={`container mx-auto p-4 space-y-4 ${darkMode ? 'dark' : ''}`}>
      {/* Top‑bar ---------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <h1 className="text-2xl font-bold mr-4">Shawinv</h1>
        <Input
          ref={searchInputRef}
          placeholder="Search inventory…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="sm:max-w-sm"
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="ml-auto">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="sm:w-60" align="end" forceMount>
            <div className="px-4 py-2">
              <Label htmlFor="defaultUnit">Default Unit</Label>
              <Select
                onValueChange={(v) => setDefaultUnit(v as Unit)}
                defaultValue={defaultUnit}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {unitOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="px-4 py-2 flex items-center justify-between">
              <Label htmlFor="darkMode" className="text-sm font-medium">Dark Mode</Label>
              <Switch
                id="darkMode"
                checked={darkMode}
                onCheckedChange={setDarkMode}
              />
            </div>
            
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tabs ------------------------------------------------------- */}
      <Tabs defaultValue="inventory" className="w-full space-y-4">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 gap-1">
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="add" onClick={() => setSubtractMode(false)}>Add Item</TabsTrigger>
          <TabsTrigger value="subtract" onClick={() => setSubtractMode(true)}>Subtract</TabsTrigger>
          <TabsTrigger value="changelog">Log</TabsTrigger>
          <TabsTrigger value="importexport">CSV</TabsTrigger>
          <TabsTrigger value="image">Image</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Current Inventory</CardTitle>
              <Button variant="outline" size="sm" onClick={undoLastChange} disabled={previousStates.length === 0}>
                <RotateCcw className="mr-2 h-4 w-4" /> Undo
              </Button>
            </CardHeader>
            <CardContent>
              <InventoryList
                inventory={inventory}
                onDeleteItem={deleteItem}
                onEditItem={editItem}
                defaultUnit={defaultUnit}
                convertUnits={convertUnits}
                searchQuery={searchQuery}
                subcategoryOptions={subcategoryOptions}
                unitOptions={unitOptions}
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
              <InventoryForm
                onAddItem={addItem}
                unitOptions={UNIT_OPTIONS}
                subcategoryOptions={SUBCATEGORY_OPTIONS}
                defaultSubcategory={defaultSubcategory}
              />
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
              <AlertDialog
                open={isAlertDialogOpen}
                onOpenChange={setIsAlertDialogOpen}
              >
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="text-red-500 mt-4">
                    Clear log
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Are you sure you want to clear the change log?
                    </AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        setChangeLog([]);
                        setIsAlertDialogOpen(false);
                      }}
                      className="bg-red-500 text-white hover:bg-red-600"
                    >
                      Clear
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>

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

        <TabsContent value="image">
          <Card>
            <CardHeader>
              <CardTitle>Image ➜ Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageToInventory
                onAddItem={addItem}
                defaultSubcategory={defaultSubcategory}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}