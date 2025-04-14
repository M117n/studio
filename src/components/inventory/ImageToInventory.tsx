"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { ImageIcon } from "lucide-react";
import {extractInventoryFromImage} from "@/ai/flows/extract-inventory-from-image";

interface ImageToInventoryProps {
  onAddItem: (item: { name: string; quantity: number; unit: string }) => void;
}

export const ImageToInventory: React.FC<ImageToInventoryProps> = ({
  onAddItem,
}) => {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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
      const inventoryItems = await extractInventoryFromImage({imageBase64: image});
      inventoryItems.forEach((item) => {
        onAddItem({ name: item.name, quantity: item.quantity, unit: item.unit });
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
        <label htmlFor="image-upload">
          <Button asChild>
            <ImageIcon className="mr-2 h-4 w-4" />
            <span>Upload Image</span>
          </Button>
        </label>
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
