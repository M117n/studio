"use client";

import { useState, useEffect } from "react";
import { InventoryList } from "@/components/inventory/InventoryList";
import { InventoryForm } from "@/components/inventory/InventoryForm";
import { ChangeLog } from "@/components/inventory/ChangeLog";
import { CsvImportExport } from "@/components/inventory/CsvImportExport";
import { ImageToInventory } from "@/components/inventory/ImageToInventory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

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

  useEffect(() => {
    localStorage.setItem("inventory", JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem("changeLog", JSON.stringify(changeLog));
  }, [changeLog]);

  const addItem = (item: Omit<InventoryItem, "id">) => {
    const newItem: InventoryItem = { ...item, id: crypto.randomUUID() };
    setInventory([...inventory, newItem]);
    setChangeLog([
      ...changeLog,
      `${new Date().toLocaleString()} - Added ${item.quantity} ${
        item.unit
      } of ${item.name}`,
    ]);
    setPreviousStates([...previousStates, inventory]);
  };

  const deleteItem = (id: string) => {
    const deletedItem = inventory.find((item) => item.id === id);
    if (deletedItem) {
      setInventory(inventory.filter((item) => item.id !== id));
      setChangeLog([
        ...changeLog,
        `${new Date().toLocaleString()} - Deleted ${deletedItem.quantity} ${
          deletedItem.unit
        } of ${deletedItem.name}`,
      ]);
    }
    setPreviousStates([...previousStates, inventory]);
  };

  const editItem = (id: string, updatedItem: Omit<InventoryItem, "id">) => {
    const originalItem = inventory.find((item) => item.id === id);
    setInventory(
      inventory.map((item) =>
        item.id === id ? { ...item, ...updatedItem } : item
      )
    );
    if (originalItem) {
      setChangeLog([
        ...changeLog,
        `${new Date().toLocaleString()} - Edited ${originalItem.quantity} ${
          originalItem.unit
        } of ${originalItem.name} to ${updatedItem.quantity} ${
          updatedItem.unit
        } of ${updatedItem.name}`,
      ]);
    }
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

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">StockWatch AI</h1>

      <Tabs defaultvalue="inventory" className="w-full space-y-4">
        <TabsList>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="add">Add Item</TabsTrigger>
          <TabsTrigger value="changelog">Change Log</TabsTrigger>
          <TabsTrigger value="importexport">Import / Export</TabsTrigger>
          <TabsTrigger value="image">Image to Inventory</TabsTrigger>
        </TabsList>
        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle>Current Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <InventoryList
                inventory={inventory}
                onDeleteItem={deleteItem}
                onEditItem={editItem}
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
              <InventoryForm onAddItem={addItem} />
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
              {previousStates.length > 0 && (
                <button
                  className="bg-accent text-white p-2 rounded"
                  onClick={restorePreviousState}
                >
                  Restore Previous State
                </button>
              )}
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
              <ImageToInventory onAddItem={addItem} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
