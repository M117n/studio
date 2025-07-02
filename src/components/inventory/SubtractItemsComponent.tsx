// src/components/inventory/SubtractItemsComponent.tsx
"use client";

import { useState, useEffect } from 'react';
import type { InventoryItem } from '@/types/inventory';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "@/hooks/use-toast"; // Assuming you have a toast hook
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth } from "@/lib/firebaseClient"; // For db instance

interface SubtractItemsComponentProps {
  inventory: InventoryItem[];
  userId?: string;
  userName?: string; // Already optional, aligns with InventoryApp changes
}

interface ItemToRequest extends InventoryItem {
  quantityToRemove: number;
}

export function SubtractItemsComponent({ inventory, userId, userName }: SubtractItemsComponentProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedForQuantity, setSelectedForQuantity] = useState<InventoryItem | null>(null);
  const [currentQuantityInput, setCurrentQuantityInput] = useState<string>("");
  const [itemsToRequest, setItemsToRequest] = useState<Map<string, ItemToRequest>>(new Map());

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) && !itemsToRequest.has(item.id)
  );

  const handleSelectItemForQuantity = (item: InventoryItem) => {
    setSelectedForQuantity(item);
    setCurrentQuantityInput(""); // Reset quantity input when a new item is selected
  };

  const handleConfirmQuantity = () => {
    if (!selectedForQuantity) return;

    const quantityNum = parseFloat(currentQuantityInput);

    if (isNaN(quantityNum) || quantityNum <= 0) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a positive number.",
        variant: "destructive",
      });
      return;
    }
    if (quantityNum > selectedForQuantity.quantity) {
      toast({
        title: "Insufficient Stock",
        description: `Cannot remove more than available: ${selectedForQuantity.quantity} ${selectedForQuantity.unit}.`,
        variant: "destructive",
      });
      return;
    }

    setItemsToRequest(prev => 
      new Map(prev).set(selectedForQuantity.id, { ...selectedForQuantity, quantityToRemove: quantityNum })
    );
    setSelectedForQuantity(null);
    setCurrentQuantityInput("");
    setSearchTerm(""); // Clear search after adding to prevent re-selecting
    toast({
      title: "Item Added",
      description: `${selectedForQuantity.name} (Qty: ${quantityNum}) added to removal list.`,
    });
  };

  const handleRemoveFromRequestList = (itemId: string) => {
    setItemsToRequest(prev => {
      const newMap = new Map(prev);
      newMap.delete(itemId);
      return newMap;
    });
    toast({
      title: "Item Removed",
      description: "Item removed from removal list.",
    });
  };

  const handleSubmitRequest = async () => {
    if (!userId || !userName) {
      toast({
        title: "Authentication Error",
        description: "User information not found. Please try logging in again.",
        variant: "destructive",
      });
      return;
    }

    if (itemsToRequest.size === 0) {
      toast({
        title: "No Items Selected",
        description: "Please select items and quantities to request for removal.",
        variant: "destructive",
      });
      return;
    }

    const db = getFirestore(auth.app);
    const removalRequestsCollection = collection(db, "removalRequests");

    const requestedItemsArray = Array.from(itemsToRequest.values()).map(reqItem => ({
      itemId: reqItem.id,
      name: reqItem.name,
      category: reqItem.category || null, // Ensure null if undefined
      // imageUrl: reqItem.imageUrl || null, // Removed as imageUrl is not on InventoryItem type
      quantityToRemove: reqItem.quantityToRemove,
      unit: reqItem.unit,
    }));

    try {
      await addDoc(removalRequestsCollection, {
        userId,
        userName,
        requestedItems: requestedItemsArray,
        requestTimestamp: serverTimestamp(),
        status: 'pending', // Initial status
      });

      toast({
        title: "Request Submitted Successfully",
        description: "Your removal request has been sent for admin approval.",
      });
      setItemsToRequest(new Map()); // Clear the list after submission
    } catch (error) {
      console.error("Error submitting removal request: ", error);
      toast({
        title: "Submission Error",
        description: "Could not submit removal request. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Derived state for items displayed in the request list
  const requestListArray = Array.from(itemsToRequest.values());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subtract Items from Inventory</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <label htmlFor="item-search">Search for item to remove</label>
            <Input 
              id="item-search"
              type="text"
              placeholder="Start typing item name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Search Results & Quantity Input Modal Trigger */}
          {searchTerm && (
            <div className="border rounded-md max-h-72 overflow-y-auto">
              {filteredInventory.length > 0 ? (
                filteredInventory.map(item => (
                  <div 
                    key={item.id} 
                    className="p-3 hover:bg-accent cursor-pointer flex justify-between items-center border-b last:border-b-0"
                    onClick={() => handleSelectItemForQuantity(item)}
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Stock: {item.quantity} {item.unit} {item.category && `| ${item.category}`}</p>
                    </div>
                    <Button variant="outline" size="sm">Set Quantity</Button>
                  </div>
                ))
              ) : (
                <p className="p-3 text-sm text-muted-foreground text-center">No items found matching "{searchTerm}" or already in list.</p>
              )}
            </div>
          )}

          {/* Modal for Setting Quantity */}
          {selectedForQuantity && (
            <AlertDialog open={!!selectedForQuantity} onOpenChange={() => setSelectedForQuantity(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Set Quantity for: {selectedForQuantity.name}</AlertDialogTitle>
                  <AlertDialogDescription>
                    Available stock: {selectedForQuantity.quantity} {selectedForQuantity.unit}. 
                    Enter the quantity you wish to request for removal.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-2">
                  <Input
                    type="number"
                    step="any"
                    placeholder={`Quantity (max ${selectedForQuantity.quantity})`}
                    value={currentQuantityInput}
                    onChange={(e) => setCurrentQuantityInput(e.target.value)}
                    min="0"
                    max={selectedForQuantity.quantity}
                    autoFocus
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setSelectedForQuantity(null)}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmQuantity}>Confirm Quantity</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Items Selected for Removal Request */}
          {requestListArray.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 border-t pt-4">Items to Request for Removal:</h3>
              <div className="space-y-3">
                {requestListArray.map(reqItem => (
                  <div key={reqItem.id} className="flex items-center justify-between p-3 border rounded-md bg-secondary/10">
                    <div>
                      <p className="font-medium">{reqItem.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Requesting to remove: <span className="font-semibold text-primary">{reqItem.quantityToRemove} {reqItem.unit}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">Current stock: {reqItem.quantity} {reqItem.unit}</p>
                    </div>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveFromRequestList(reqItem.id)}
                      className="text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      Remove from List
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit Request Button with Confirmation */}
          {requestListArray.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    className="w-full md:w-auto"
                    disabled={requestListArray.length === 0}
                  >
                    Send Removal Request
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Removal Request</AlertDialogTitle>
                    <AlertDialogDescription>
                      You are about to request the removal of {requestListArray.length} item(s).
                      This action requires admin approval before inventory is updated.
                      Are you sure you want to proceed?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleSubmitRequest} 
                      className="bg-destructive hover:bg-destructive/90"
                      disabled={!userId || itemsToRequest.size === 0} // Disable if no user or no items
                    >
                      Yes, Send Request
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
