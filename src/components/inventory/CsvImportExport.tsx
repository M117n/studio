"use client";

import { useState } from "react";
import { parse, unparse } from "papaparse";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

interface CsvImportExportProps {
  inventory: InventoryItem[];
  setInventory: (inventory: InventoryItem[]) => void;
  setChangeLog: (changeLog: string[]) => void;
  setPreviousStates: (previousStates: InventoryItem[][]) => void;
}

export const CsvImportExport: React.FC<CsvImportExportProps> = ({
  inventory,
  setInventory,
  setChangeLog,
  setPreviousStates,
}) => {
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setCsvFile(event.target.files[0]);
    }
  };

  const handleImport = () => {
    if (!csvFile) {
      toast({
        title: "No file selected.",
        description: "Please select a CSV file to import.",
      });
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      const csvData = event.target?.result as string;

      parse(csvData, {
        header: true,
        complete: (results) => {
          try {
            const importedData: InventoryItem[] = results.data
              .filter((row: any) => row.name && row.quantity && row.unit)
              .map((row: any) => ({
                id: crypto.randomUUID(),
                name: row.name,
                quantity: parseFloat(row.quantity),
                unit: row.unit,
              }));

            setPreviousStates((prev) => [...prev, inventory]);
            setInventory(importedData);
            setChangeLog((prev) => [
              ...prev,
              `${new Date().toLocaleString()} - Imported inventory from CSV`,
            ]);
            toast({
              title: "Import Successful",
              description: "Inventory has been updated from the CSV file.",
            });
          } catch (error) {
            toast({
              variant: "destructive",
              title: "Parse error",
              description: "Error parsing CSV",
            });
          }
        },
        error: (error) => {
          toast({
            variant: "destructive",
            title: "Import failed.",
            description: `CSV parsing error: ${error.message}.`,
          });
        },
      });
    };

    reader.onerror = () => {
      toast({
        variant: "destructive",
        title: "Import failed.",
        description: "Failed to read the CSV file.",
      });
    };

    reader.readAsText(csvFile);
  };

  const handleExport = () => {
    if (inventory.length === 0) {
      toast({
        title: "Nothing to export.",
        description: "The inventory list is empty.",
      });
      return;
    }

    const csvData = unparse(inventory, {
      header: true,
    });

    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "inventory.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: "Inventory has been exported to CSV.",
    });
  };

  return (
    <div className="flex flex-col space-y-4">
      <div>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
          id="csv-upload"
        />
        <label htmlFor="csv-upload">
          <Button asChild>
            <span className="mr-2">Import CSV</span>
          </Button>
        </label>
        <Button variant="outline" onClick={handleImport} className="ml-2">
          Upload
        </Button>
      </div>
      <Button variant="secondary" onClick={handleExport}>
        Export CSV
      </Button>
    </div>
  );
};
