/*  src/components/inventory/ImageToInventory.tsx  */
/* ------------------------------------------------------------- */
"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { ImageIcon } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
type Category =
  | "fruit"
  | "vegetable"
  | "canned"
  | "juices"
  | "dry"
  | "frozen"
  | "dairy"
  | "other";

interface ImageToInventoryProps {
  onAddItem: (item: {
    name: string;
    quantity: number;
    unit: string;
    category: Category;
  }) => void;
  defaultCategory: Category;
}

/* ------------------------------------------------------------------ */
/*  Helper to call the backend API                                    */
/* ------------------------------------------------------------------ */
async function getCsvFromImage(base64: string): Promise<string> {
  const res = await fetch("/api/analyze-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64 }),
  });

  if (!res.ok) {
    throw new Error(`analyze-image error: ${res.status} ${await res.text()}`);
  }

  // Backend returns plain CSV; strip any code fences just in case
  const text = await res.text();
  return text.replace(/```[^]*?```/g, (m) => m.slice(3, -3)).trim();
}

/* ------------------------------------------------------------------ */
/*  CSV → rows parser                                                 */
/* ------------------------------------------------------------------ */
function parseCsv(csv: string) {
  return csv
    .trim()
    .split(/\r?\n/)
    .slice(1) // drop header row
    .map((line) => {
      const [name, quantity, unit, category] = line.split(",").map((s) => s.trim());
      return {
        name,
        quantity: parseFloat(quantity),
        unit,
        category: (category || "other") as Category,
      };
    })
    .filter((row) => row.name);
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export const ImageToInventory: React.FC<ImageToInventoryProps> = ({
  onAddItem,
  defaultCategory,
}) => {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ------------------------------ upload -------------------------- */
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  /* ------------------------------ analyze ------------------------- */
  const handleAnalyzeImage = async () => {
    if (!imageDataUrl) {
      toast({ title: "No image selected", description: "Please upload an image first." });
      return;
    }

    setIsAnalyzing(true);
    try {
      const base64 = imageDataUrl.split(",")[1] ?? "";
      const csvText = await getCsvFromImage(base64);
      const rows = parseCsv(csvText);

      if (!rows.length) {
        toast({ title: "No items detected", description: "The AI returned an empty list." });
        return;
      }

      rows.forEach((row) =>
        onAddItem({
          name: row.name,
          quantity: isNaN(row.quantity) ? 1 : row.quantity,
          unit: row.unit || "units",
          category: row.category || defaultCategory,
        })
      );

      toast({
        title: "Inventory updated",
        description: `${rows.length} item(s) added from image.`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Analysis failed",
        description: err?.message ?? "Unexpected error.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  UI                                                              */
  /* ---------------------------------------------------------------- */
  return (
    <div className="flex flex-col space-y-4">
      {/* hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* upload button */}
      <Button
        type="button"
        variant="outline"
        className="flex items-center w-full sm:w-auto"
        onClick={() => fileInputRef.current?.click()}
      >
        <ImageIcon className="mr-2 h-4 w-4" />
        Upload Image
      </Button>

      {/* preview */}
      {imageDataUrl && (
        <img
          src={imageDataUrl}
          alt="preview"
          className="max-h-64 rounded-md object-contain"
        />
      )}

      {/* analyze button */}
      <Button onClick={handleAnalyzeImage} disabled={isAnalyzing}>
        {isAnalyzing ? "Analyzing…" : "Analyze Image"}
      </Button>
    </div>
  );
};
