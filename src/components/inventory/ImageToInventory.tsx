"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { ImageIcon } from "lucide-react";
import {extractInventoryFromImage} from "@/ai/flows/extract-inventory-from-image";
import type { InventoryItemData, Unit } from "@/types/inventory";
import type { Category, SubCategory } from "@/types/inventory";
import { getMainCategory } from "@/types/inventory";

interface ImageToInventoryProps {
  onAddItem: (item: InventoryItemData) => void;
  defaultSubcategory: SubCategory;
}

export const ImageToInventory: React.FC<ImageToInventoryProps> = ({
  onAddItem,
    defaultSubcategory,
}) => {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Handle raw image upload without compression
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyzeImage = async () => {
    if (!image) {
      toast({
        title: "No image selected.",
        description: "Please upload an image to analyze.",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const inventoryItems = await extractInventoryFromImage({ imageBase64: image });
      // If no relevant items found, warn user and do not update inventory
      if (!inventoryItems || inventoryItems.length === 0) {
        toast({
          variant: "destructive",
          title: "No Items Found",
          description: "The uploaded image does not contain identifiable inventory items.",
        });
        return;
      }
      // Add each recognized item to inventory
      inventoryItems.forEach((item) => {
        onAddItem({
                    name: item.name,
                    quantity: item.quantity,
                    unit: item.unit as Unit,
                    subcategory: defaultSubcategory,
                    category: getMainCategory(defaultSubcategory),
                  });
      });
      toast({
        title: "Analysis Complete",
        description: "Items have been added to the inventory.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: error.message || "Failed to analyze the image.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      <div>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
          id="image-upload"
        />
        <Button asChild>
          <label htmlFor="image-upload" className="cursor-pointer">
            <ImageIcon className="mr-2 h-4 w-4" />
            <span>Upload Image</span>
          </label>
        </Button>
      </div>
      {image && (
        <img
          src={image}
          alt="Uploaded"
          className="max-h-64 rounded-md object-contain"
        />
      )}
      <Button onClick={handleAnalyzeImage} disabled={isAnalyzing}>
        {isAnalyzing ? "Analyzing..." : "Analyze Image"}
      </Button>
    </div>
  );
};

