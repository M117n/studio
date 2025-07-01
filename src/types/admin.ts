import type { Timestamp } from 'firebase-admin/firestore';

// Renamed from RequestedAddItemDetail to match usage in other files.
export interface RequestedAdditionItem {
  name: string;
  category: string;
  subcategory: string;
  quantityToAdd: number;
  unit: string;
}

export interface AdditionRequestDoc {
  userId: string;
  userName: string;
  requestTimestamp: Timestamp; // Firestore Timestamp type
  status: 'pending' | 'approved' | 'rejected';
  
  // To support both single and multiple item requests, requestedItem is now optional,
  // and an optional array of items (requestedItems) has been added.
  requestedItem?: RequestedAdditionItem;
  requestedItems?: RequestedAdditionItem[];

  // Optional fields for processed requests
  adminId?: string;
  adminName?: string;
  processedTimestamp?: Timestamp;
  adminNotes?: string;
}