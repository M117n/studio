import type { Unit } from './inventory';

/** Immutable audit‑log entry */
export interface ChangeLogEntry {
  timestamp: FirebaseFirestore.FieldValue;          // serverTimestamp()
  userId:    string;
  action:   'CREATE' | 'UPDATE' | 'DELETE';
  name:      string;
  category:  string;
  subcategory: string;
  quantity:  number;
  unit:      Unit;
}
