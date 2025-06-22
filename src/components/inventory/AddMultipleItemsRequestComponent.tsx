"use client";

import { useState } from "react";
import type { Unit, SubCategory, Category } from "@/types/inventory";
import { getMainCategory } from "@/types/inventory";
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
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

interface AddMultipleItemsRequestComponentProps {
  unitOptions: readonly string[];
  subcategoryOptions: readonly string[];
  defaultSubcategory: SubCategory;
  userId?: string;
  userName?: string;
}

type RequestedItem = {
  id: string;
  name: string;
  category: Category;
  subcategory: SubCategory;
  quantityToAdd: number;
  unit: Unit;
};

const formSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  subcategory: z.string().min(1, { message: "Subcategory is required" }),
  quantity: z.coerce.number().positive({ message: "Quantity must be positive" }),
  unit: z.string().min(1, { message: "Unit is required" }),
});

type FormValues = z.infer<typeof formSchema>;

export function AddMultipleItemsRequestComponent({
  unitOptions,
  subcategoryOptions,
  defaultSubcategory,
  userId,
  userName,
}: AddMultipleItemsRequestComponentProps) {
  const [itemsToRequest, setItemsToRequest] = useState<Map<string, RequestedItem>>(new Map());
  const [itemCounter, setItemCounter] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      subcategory: defaultSubcategory,
      quantity: undefined,
      unit: unitOptions.length > 0 ? (unitOptions[0] as Unit) : undefined,
    },
  });

  const handleAddToList = (values: FormValues) => {
    const id = `tmp-${itemCounter}`;
    setItemCounter((prev) => prev + 1);
    const item: RequestedItem = {
      id,
      name: values.name,
      category: getMainCategory(values.subcategory as SubCategory),
      subcategory: values.subcategory as SubCategory,
      quantityToAdd: values.quantity,
      unit: values.unit as Unit,
    };
    setItemsToRequest((prev) => new Map(prev).set(id, item));
    toast({
      title: "Item Added",
      description: `${item.name} (${item.quantityToAdd} ${item.unit}) added to list`,
    });
    form.reset({
      name: "",
      subcategory: defaultSubcategory,
      quantity: undefined,
      unit: unitOptions.length > 0 ? (unitOptions[0] as Unit) : undefined,
    });
  };

  const handleRemoveItem = (id: string) => {
    setItemsToRequest((prev) => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  };

  const handleSubmitRequest = async () => {
    if (!userId || !userName) {
      toast({ title: "Auth Error", description: "User not authenticated", variant: "destructive" });
      return;
    }
    if (itemsToRequest.size === 0) {
      toast({ title: "No Items", description: "Add items before submitting", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const body = {
        userId,
        userName,
        requestedItems: Array.from(itemsToRequest.values()).map(({ id, ...rest }) => rest),
      };
      const resp = await fetch("/api/inventory/request-addition", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error || "Request failed");
      }
      toast({ title: "Request Submitted" });
      setItemsToRequest(new Map());
      setShowConfirmDialog(false);
    } catch (e: any) {
      console.error("Error submitting request", e);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onAddToList = (values: FormValues) => {
    handleAddToList(values);
  };

  const requestList = Array.from(itemsToRequest.values());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Multiple Items (Admin Approval)</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onAddToList)} className="space-y-6">
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
                        value={field.value === undefined ? '' : field.value}
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {unitOptions.map((unit) => (
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select subcategory" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {subcategoryOptions.map((subcat) => (
                          <SelectItem key={subcat} value={subcat}>{subcat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              Add to List
            </Button>
          </form>
        </Form>

        {requestList.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="font-semibold text-md">Items to Add:</h3>
            <div className="space-y-2">
              {requestList.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded-md bg-secondary/10">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.quantityToAdd} {item.unit} | {item.subcategory}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleRemoveItem(item.id)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full md:w-auto">Send Addition Request</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Addition Request</AlertDialogTitle>
                  <AlertDialogDescription>
                    You are about to request the addition of {requestList.length} item(s).
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSubmitRequest} disabled={isSubmitting}>
                    Confirm
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AddMultipleItemsRequestComponent;
