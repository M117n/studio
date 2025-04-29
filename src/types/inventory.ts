export interface InventoryItemData {
  name: string;
  quantity: number;
  unit: string;
  category: string;
}

export interface InventoryItem extends InventoryItemData {
  id: string;
}