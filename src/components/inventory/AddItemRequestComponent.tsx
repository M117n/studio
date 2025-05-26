'use client';

import { useState } from 'react';
import type { Unit, SubCategory, InventoryItem } from '@/types/inventory';
import { getMainCategory } from '@/types/inventory';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { toast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebaseClient";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

interface AddItemRequestComponentProps {
  unitOptions: readonly string[];
  subcategoryOptions: readonly string[];
  defaultSubcategory: SubCategory;
  userId?: string;
  userName?: string;
}

// Form validation schema
const formSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  subcategory: z.string().min(1, { message: "Subcategory is required" }), // Ensure this aligns with SubCategory type
  quantity: z.coerce.number().positive({ message: "Quantity must be positive" }),
  unit: z.string().min(1, { message: "Unit is required" }),
});

type FormValues = z.infer<typeof formSchema>;

export function AddItemRequestComponent({
  unitOptions,
  subcategoryOptions,
  defaultSubcategory,
  userId,
  userName,
}: AddItemRequestComponentProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      subcategory: defaultSubcategory,
      quantity: undefined,
      unit: unitOptions.length > 0 ? (unitOptions[0] as Unit) : undefined, // Safer default for unit
    },
  });

  const handleSubmitAddRequest = async (values: FormValues) => {
    if (!userId || !userName) {
      toast({
        title: "Authentication Error",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Create a structured request object
      const derivedCategory = getMainCategory(values.subcategory as SubCategory);
      const requestData = {
        userId,
        userName,
        requestedItem: {
          name: values.name,
          category: derivedCategory,
          subcategory: values.subcategory as SubCategory,
          quantityToAdd: values.quantity,
          unit: values.unit as Unit, // cast for clarity
        },
      };

      // Use server API endpoint instead of direct Firestore access
      const response = await fetch('/api/inventory/request-addition', { // 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Request submission failed');
      }
      
      toast({
        title: "Request Submitted",
      });

      // Reset the form
      form.reset({
        name: "",
        subcategory: defaultSubcategory,
        quantity: undefined,
        unit: unitOptions.length > 0 ? (unitOptions[0] as Unit) : undefined,
      });
      setShowConfirmDialog(false);
    } catch (error: any) {
      console.error("Error submitting addition request:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = (values: FormValues) => {
    setShowConfirmDialog(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New Item (Admin Approval Required)</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter item name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input 
                        type="text" 
                        inputMode="decimal" 
                        pattern="\d*(\.\d+)?" 
                        placeholder="0" 
                        {...field} 
                        value={field.value === undefined ? '' : field.value} // Ensure controlled input
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {unitOptions.map(unit => (
                          <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="subcategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subcategory</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select subcategory" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {subcategoryOptions.map(subcat => (
                          <SelectItem key={subcat} value={subcat}>{subcat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Item Addition Request'}
            </Button>
          </form>
        </Form>

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Item Addition Request</AlertDialogTitle>
              <AlertDialogDescription>
                You are about to submit a request to add a new item to the inventory.
                This request will need admin approval before the item is added.
                Are you sure you want to proceed?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => handleSubmitAddRequest(form.getValues())}
                disabled={isSubmitting}
              >
                Yes, Submit Request
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
