import { Timestamp as FirebaseAdminTimestamp } from 'firebase-admin/firestore';
import { Timestamp as FirebaseClientTimestamp } from 'firebase/firestore';

export type AppTimestamp = FirebaseAdminTimestamp | FirebaseClientTimestamp;
