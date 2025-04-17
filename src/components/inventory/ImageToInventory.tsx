/*  src/components/inventory/ImageToInventory.tsx  */
/* ─────────────────────────────────────────────── */
"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { ImageIcon } from "lucide-react";

/* ---------- types ------------------------------------------------- */
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

/* ---------- helpers ---------------------------------------------- */
async function getCsvFromImage(base64: string): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? "";
  const endpoint =
    process.env.NEXT_PUBLIC_OPENAI_API_PROXY ??
    "https://api.openai.com/v1/chat/completions";

  const body = {
    model: "gpt-4o-mini",
    max_tokens: 1024,
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "You are an expert inventory assistant. Extract every item you see in the image I send. " +
          "Return ONLY a CSV (no code fences) with columns: name,quantity,unit,category. " +
          "If a field is unknown, leave it blank. Use a single header row exactly as given.",
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${base64}` },
          },
        ],
      },
    ],
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`OpenAI error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.choices[0].message.content as string;
}

function parseCsv(csv: string) {
  return csv
    .trim()
    .split(/\r?\n/)
    .slice(1) // header
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

/* ---------- component -------------------------------------------- */
export const ImageToInventory: React.FC<ImageToInventoryProps> = ({
  onAddItem,
  defaultCategory,
}) => {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  /* file input ref for programmatic click */
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* upload handler */
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  /* analyze handler */
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

  /* ---------- UI -------------------------------------------------- */
  return (
    <div className="flex flex-col space-y-4">
      {/* hidden input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* visible upload button */}
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
