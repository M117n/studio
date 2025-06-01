// components/inventory/InventoryApp.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { InventoryList } from "@/components/inventory/InventoryList";
import { InventoryForm } from "@/components/inventory/InventoryForm";
import { AddItemRequestComponent } from "@/components/inventory/AddItemRequestComponent";
import { ChangeLog } from "@/components/inventory/ChangeLog";
import { CsvImportExport } from "@/components/inventory/CsvImportExport";
import { ImageToInventory } from "@/components/inventory/ImageToInventory";
import { SubtractItemsComponent } from "@/components/inventory/SubtractItemsComponent";
import { InventoryItem, Unit, SubCategory, Category } from "@/types/inventory";
import { UNIT_OPTIONS, SUBCATEGORY_OPTIONS, getMainCategory } from "@/types/inventory";
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Settings, LogOut, RotateCcw } from "lucide-react";
import { auth } from "@/lib/firebaseClient";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

import { useInventory } from "@/hooks/useInventory";
import { useAuth } from "@/hooks/useAuth";
import { AdminPanelModal } from "@/components/admin/AdminPanelModal";

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const unitOptions = UNIT_OPTIONS;
const subcategoryOptions = SUBCATEGORY_OPTIONS;

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function InventoryApp() {
  /* ----------------------------- data ---------------------------- */
  const {
    inventory,
    loading: inventoryLoading,
    addItem:   addItemDb,
    editItem:  editItemDb,
    deleteItem: deleteItemDb,
  } = useInventory();

  /* --------------------------- auth user ------------------------ */
  const currentUser = auth.currentUser;
  const userId = currentUser?.uid;
  const userName = currentUser?.displayName || currentUser?.email || undefined; // Ensure it's string or undefined
  const { isAdmin, user, isAuthenticated, loading: authLoading } = useAuth(); // Get user admin status and other auth data

  /* ------------------------- local state ------------------------- */
  const [changeLog, setChangeLog] = useState<string[]>(() =>
    JSON.parse(localStorage.getItem("changeLog") ?? "[]"),
  );
  const [previousStates, setPreviousStates] = useState<InventoryItem[][]>([]);
  const [defaultUnit, setDefaultUnit] = useState<Unit>(
    () => (localStorage.getItem("defaultUnit") as Unit) || "kg",
  );
  const [defaultSubcategory, setDefaultSubcategory] = useState<SubCategory>(
    () =>
      (localStorage.getItem("defaultSubCategory") as SubCategory) || "other",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
  const [subtractMode, setSubtractMode] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  /* ----------------------------- refs ----------------------------- */
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* ------------------------ auth helpers ------------------------- */
  const router = useRouter();
  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      // 1. Sign out from Firebase client-side
      await auth.signOut();
      
      // 2. Clear server-side session cookie
      const response = await fetch("/api/auth/sessionLogout", { method: "POST" });
      if (!response.ok) {
        // Even if server-side fails, client is signed out. Log error but proceed.
        console.error("Failed to clear server session, but client signed out.");
        // Optionally show a less severe toast or just log
      }
      
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      
      // 3. Redirect to login page (or homepage)
      router.push("/auth/login"); // Or your desired redirect path

    } catch (error: any) {
      console.error("Error during logout:", error);
      toast({
        title: "Logout Error",
        description: error.message || "Failed to logout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLogoutLoading(false);
    }
  };

  /* ----------------------- local persistence --------------------- */
  useEffect(() => localStorage.setItem("changeLog", JSON.stringify(changeLog)), [changeLog]);
  useEffect(() => localStorage.setItem("defaultUnit", defaultUnit), [defaultUnit]);
  useEffect(
    () => localStorage.setItem("defaultSubCategory", defaultSubcategory),
    [defaultSubcategory],
  );

  /* --------------------------- handlers --------------------------- */
  /** Add or merge (or subtract) an item */
  const addItem = (item: Omit<InventoryItem, "id">) => {
    const delta = subtractMode ? -item.quantity : item.quantity;
    const existing = inventory.find((i) => i.name === item.name);

    if (existing) {
      const conv = convertUnits(delta, item.unit, existing.unit);
      if (conv === null) {
        toast({
          variant: "destructive",
          title: "Conversion not possible",
          description: `Cannot convert ${item.unit} to ${existing.unit}.`,
        });
        return;
      }
      editItemDb({ id: existing.id, quantity: existing.quantity + conv });
      setChangeLog((cl) => [
        ...cl,
        `${new Date().toLocaleString()} - ${
          subtractMode ? "Subtracted" : "Added"
        } ${item.quantity} ${item.unit} (→ ${conv} ${existing.unit}) ${
          subtractMode ? "from" : "to"
        } ${existing.name}.`,
      ]);
    } else {
      // Ensure category is correctly set based on subcategory
      const ensuredCategory: Category = item.subcategory ? getMainCategory(item.subcategory) : (item.category ?? Category.OTHER);
      
      // Add the item with the guaranteed category and quantity
      addItemDb({ 
        ...item, 
        quantity: delta,
        category: ensuredCategory 
      });
      
      setChangeLog((cl) => [
        ...cl,
        `${new Date().toLocaleString()} - Added ${item.quantity} ${item.unit} of ${item.name}.`,
      ]);
    }
  };

  /** Edit */
  const editItem = (id: string, patch: Partial<InventoryItem>) => {
    const original = inventory.find((i) => i.id === id);
    if (!original) return;

    // Handle unit conversion
    let newQuantity = original.quantity; // Default to original quantity
    
    if (patch.quantity !== undefined) {
      // If unit is changing or quantity is changing
      if (patch.unit && patch.unit !== original.unit) {
        // When units are different, we need conversion
        const conv = convertUnits(patch.quantity, patch.unit, original.unit);
        
        if (conv === null) {
          // Invalid conversion between incompatible units
          toast({
            variant: "destructive",
            title: "Conversion not possible",
            description: "Cannot convert between these units."
          });
          return;
        }
        
        newQuantity = conv;
      } else {
        // Same unit or no unit change, just use the new quantity directly
        newQuantity = patch.quantity;
      }
    }

    setPreviousStates((ps) => [...ps, inventory]);
    editItemDb({ id, ...patch, quantity: newQuantity });
    setChangeLog((cl) => [
      ...cl,
      `${new Date().toLocaleString()} - Edited ${original.name}.`,
    ]);
  };

  /** Delete */
  const deleteItem = (id: string) => {
    const target = inventory.find((i) => i.id === id);
    if (!target) return;
    setPreviousStates((ps) => [...ps, inventory]);
    deleteItemDb(id);
    setChangeLog((cl) => [
      ...cl,
      `${new Date().toLocaleString()} - Deleted ${target.name}.`,
    ]);
  };

  /** Undo (by replaying the snapshot into Firestore) */
  const undoLastChange = () => {
    if (!previousStates.length) return;
    const prev = previousStates[previousStates.length - 1];
    prev.forEach(({ id, ...rest }) => editItemDb({ id, ...rest }));
    inventory
      .filter((i) => !prev.some((p) => p.id === i.id))
      .forEach((i) => deleteItemDb(i.id));
    setPreviousStates((ps) => ps.slice(0, -1));
    setChangeLog((cl) => [
      ...cl,
      `${new Date().toLocaleString()} - Undo last change.`,
    ]);
  };

  /* --------------------------- effects --------------------------- */
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  /* ------------------------------ UI ----------------------------- */
  if (inventoryLoading) return <p className="p-4">Loading inventory…</p>;

  return (
    <div className={`container mx-auto p-4 space-y-4 ${darkMode ? "dark" : ""}`}>
      {/* Top bar ---------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-end gap-3 shrink-0"> {/* Admin and Settings container */}
        <h1 className="text-2xl font-bold mr-4">Shawinv</h1>
        <Input
          ref={searchInputRef}
          type="search"
          placeholder="Search inventory..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-64"
        />
        
        {/* Admin Role Indicator and Panel */}
        {isAdmin && <AdminPanelModal />}
        {isAdmin ? (
          <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
            Admin Role: Active
          </span>
        ) : (
          <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
            Regular User
          </span>
        )}
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
              <Label htmlFor="darkMode" className="text-sm font-medium">
                Dark Mode
              </Label>
              <Switch id="darkMode" checked={darkMode} onCheckedChange={setDarkMode} />
            </div>

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} disabled={logoutLoading}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>{logoutLoading ? "Logging out..." : "Logout"}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tabs ------------------------------------------------------- */}
      <Tabs defaultValue="inventory" className="w-full space-y-4">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 gap-1">
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="add" onClick={() => setSubtractMode(false)}>
            Add Item
          </TabsTrigger>
          <TabsTrigger value="changelog">Log</TabsTrigger>
          <TabsTrigger value="importexport">CSV</TabsTrigger>
          <TabsTrigger value="image">Image</TabsTrigger>
          <TabsTrigger value="subtractItems">Subtract Items</TabsTrigger>
        </TabsList>

        {/* Inventory ------------------------------------------------ */}
        <TabsContent value="inventory" className="mt-12">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Current Inventory</CardTitle>
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
                isAdmin={isAdmin}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Add / Subtract ------------------------------------------ */}
        <TabsContent value="add" className="mt-12">
          <AddItemRequestComponent
            unitOptions={UNIT_OPTIONS}
            subcategoryOptions={SUBCATEGORY_OPTIONS}
            defaultSubcategory={defaultSubcategory}
            userId={userId}
            userName={userName}
          />
        </TabsContent>

        {/* Change log ---------------------------------------------- */}
        <TabsContent value="changelog" className="mt-12">
          <Card>
            <CardHeader>
              <CardTitle>Change Log</CardTitle>
            </CardHeader>
            <CardContent>
              <ChangeLog changeLog={changeLog} />
              <AlertDialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="text-red-500 mt-4">
                    Clear log
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Are you sure you want to clear the change log?
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

        {/* CSV ------------------------------------------------------ */}
        <TabsContent value="importexport" className="mt-12">
          <Card>
            <CardHeader>
              <CardTitle>CSV Import / Export</CardTitle>
            </CardHeader>
            <CardContent>
              <CsvImportExport
                inventory={inventory}
                addItem={addItem}
                editItem={editItem}
                deleteItem={deleteItem}
                setChangeLog={setChangeLog}
                setPreviousStates={setPreviousStates}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Image ---------------------------------------------------- */}
        <TabsContent value="image" className="mt-12">
          <Card>
            <CardHeader>
              <CardTitle>Image ➜ Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageToInventory
                onAddItem={addItem}
                defaultSubcategory={defaultSubcategory}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subtract Items Tab --------------------------------------- */}
        <TabsContent value="subtractItems" className="mt-12">
          <SubtractItemsComponent 
            inventory={inventory} 
            userId={userId} // string | undefined
            userName={userName} // string | undefined
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
