import type { Timestamp } from 'firebase-admin/firestore';

export interface RequestedAddItemDetail {
  name: string;
  category: string; // Original category from form
  subcategory: string;
  quantityToAdd: number;
  unit: string;
}

export interface AdditionRequestDoc {
  userId: string;
  userName: string;
  requestedItem: RequestedAddItemDetail;
  requestTimestamp: Timestamp; // Firestore Timestamp type
  status: 'pending' | 'approved' | 'rejected';
  // Optional fields for processed requests
  adminId?: string;
  adminName?: string;
  processedTimestamp?: Timestamp;
  adminNotes?: string;
}