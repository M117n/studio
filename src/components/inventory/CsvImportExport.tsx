"use client";

import { useState } from "react";
import Papa from "papaparse"; // Import without type references
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import type { Dispatch, SetStateAction } from "react";
import type {
  InventoryItem,
  SubCategory,
  Unit,
  // Category, // Category is derived, not directly used from CsvRow for type validation here
  SUBCATEGORY_OPTIONS, // Import for validation
  UNIT_OPTIONS,        // Import for validation
} from "@/types/inventory";
import { getMainCategory } from "@/types/inventory";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/* ---------------------------------- CSV row --------------------------- */
interface CsvRow {
  name: string;
  quantity: string; // se convierte a número
  unit: string;
  subcategory?: string;
}

/* ---------------------------------- props ----------------------------- */
interface CsvImportExportProps {
  inventory: InventoryItem[];
  addItem: (item: Omit<InventoryItem, "id">) => void;
  editItem: (id: string, patch: Partial<InventoryItem>) => void;
  deleteItem: (id: string) => void; // (reservado para futuro)
  setChangeLog: Dispatch<SetStateAction<string[]>>;
  setPreviousStates: Dispatch<SetStateAction<InventoryItem[][]>>;
}

/* ===================================================================== */
/*                           Component                                   */
/* ===================================================================== */
export const CsvImportExport: React.FC<CsvImportExportProps> = ({
  inventory,
  addItem,
  editItem,
  deleteItem, // eslint-disable-line @typescript-eslint/no-unused-vars
  setChangeLog,
  setPreviousStates,
}) => {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<Omit<InventoryItem, "id">[]>([]);

  /* --------------------------- import helpers ------------------------ */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setCsvFile(e.target.files[0]);
  };

  const parseCsv = () => {
    if (!csvFile) {
      toast({ title: "No file selected", description: "Choose a CSV to import." });
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const csvText = ev.target?.result as string;

      Papa.parse<CsvRow>(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          const validationErrors: string[] = [];
          // Process the parsed rows
          const processedRows = result.data.reduce((acc: Omit<InventoryItem, "id">[], row: CsvRow, index: number) => {
            // Convert quantity to number
            const quantity = parseFloat(row.quantity);
            if (isNaN(quantity) || quantity < 0) {
              validationErrors.push(`Row ${index + 2}: Invalid quantity "${row.quantity}". Must be a non-negative number.`);
              // Skip this row or handle as per requirements, here we skip
              return acc;
            }

            // Validate and determine subcategory
            const subcategoryString = row.subcategory || "other";
            let subcategory: SubCategory;
            if (SUBCATEGORY_OPTIONS.includes(subcategoryString as SubCategory)) {
              subcategory = subcategoryString as SubCategory;
            } else {
              validationErrors.push(`Row ${index + 2}: Invalid subcategory "${subcategoryString}". Defaulting to "other".`);
              subcategory = "other";
            }
            
            const category = getMainCategory(subcategory);

            // Validate unit
            const unitString = row.unit;
            let unit: Unit;
            if (UNIT_OPTIONS.includes(unitString as Unit)) {
              unit = unitString as Unit;
            } else {
              validationErrors.push(`Row ${index + 2}: Invalid unit "${unitString}". Defaulting to "piece".`);
              unit = "piece"; // Default to "piece" or handle as error
            }
            
            if (!row.name || row.name.trim() === "") {
              validationErrors.push(`Row ${index + 2}: Name is required and cannot be empty.`);
              return acc; // Skip row if name is empty
            }

            acc.push({
              name: row.name.trim(),
              quantity,
              unit,
              subcategory,
              category,
            });
            return acc;
          }, []);
          
          if (validationErrors.length > 0) {
            toast({
              title: "CSV Validation Issues",
              description: (
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {validationErrors.map((err, i) => <p key={i}>{err}</p>)}
                </div>
              ),
              variant: "destructive",
              duration: 10000, // Show for longer
            });
          }

          if (processedRows.length === 0 && result.data.length > 0) {
            // All rows might have had errors
            toast({
              title: "Import Aborted",
              description: "No valid rows to import after validation.",
              variant: "destructive",
            });
            setConfirmOpen(false);
            return;
          }
          
          setParsedRows(processedRows);
          setConfirmOpen(true);
        },
        error: (error) => {
          toast({ 
            title: "Error parsing CSV", 
            description: error.message || "Unknown error"
          });
        },
      });
    };
    reader.readAsText(csvFile);
  };

  const doImport = () => {
    setPreviousStates((prev) => [...prev, inventory]); // para Undo

    parsedRows.forEach((row) => {
      const existing = inventory.find(
        (i) => i.name.toLowerCase() === row.name.toLowerCase(),
      );
      existing
        ? editItem(existing.id, {
            quantity: row.quantity,
            unit: row.unit,
            subcategory: row.subcategory,
            category: row.category,
          })
        : addItem(row);
    });

    setChangeLog((log) => [
      ...log,
      `${new Date().toLocaleString()} – Imported ${parsedRows.length} rows from CSV`,
    ]);

    toast({
      title: "Import successful",
      description: `${parsedRows.length} items processed.`,
    });
    setConfirmOpen(false);
    setCsvFile(null);
  };

  /* --------------------------- export helper ------------------------ */
  const handleExport = () => {
    if (!inventory.length) {
      toast({ title: "Nothing to export", description: "Inventory is empty." });
      return;
    }
    const csv = Papa.unparse(inventory, { header: true });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({ title: "Export successful", description: "inventory.csv generated." });
  };

  /* ------------------------------ UI --------------------------------- */
  return (
    <div className="flex flex-col space-y-4">
      {/* Import -------------------------------------------------------- */}
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
            <span>Select CSV</span>
          </Button>
        </label>
        <Button
          variant="outline"
          onClick={parseCsv}
          className="ml-2"
          disabled={!csvFile}
        >
          Preview & Import
        </Button>
      </div>

      {/* Export -------------------------------------------------------- */}
      <Button variant="secondary" onClick={handleExport}>
        Export CSV
      </Button>

      {/* Confirm dialog ----------------------------------------------- */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Import {parsedRows.length} items from CSV?
            </AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doImport}>
              Yes, import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};