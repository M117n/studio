// src/app/admin/requests/page.tsx
"use client";

import { AdminNavbar } from '@/components/AdminNavbar';

import { useEffect, useState } from 'react';
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
  doc,
  writeBatch,
  serverTimestamp,
  runTransaction,
  DocumentReference,
  DocumentData,
  addDoc
} from 'firebase/firestore';
import { auth } from '@/lib/firebaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import type { InventoryItem } from '@/types/inventory'; // For inventory item structure

// Define a more specific type for the items within a request
interface RequestedItemDetail {
  itemId: string;
  name: string;
  quantityToRemove: number;
  unit: string;
  category?: string | null;
  // imageUrl?: string | null; // Removed as per task
}

// Define the structure of a removal request as fetched from Firestore
export interface RemovalRequest {
  id: string; // Document ID
  userId: string;
  userName: string;
  requestedItems: RequestedItemDetail[];
  requestTimestamp: Timestamp; // Firestore Timestamp
  status: 'pending' | 'approved' | 'rejected';
  adminId?: string;
  adminName?: string;
  processedTimestamp?: Timestamp;
  adminNotes?: string;
}

interface AdminUserData {
  uid: string;
  name: string;
  email: string;
  role: string;
  picture?: string;
}

const AdminPanelPage = () => {
  const [requests, setRequests] = useState<RemovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUserData | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Fetch admin user data and then removal requests
  useEffect(() => {
    const fetchAdminUser = async () => {
      setIsAuthLoading(true);
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
          throw new Error('Failed to fetch admin user data - not authenticated or server error.');
        }
        const userData: AdminUserData = await response.json();
        if (userData.role !== 'admin') {
          setError("Access Denied: You do not have permission to view this page.");
          setAdminUser(null); // Ensure adminUser is null if not admin
        } else {
          setAdminUser(userData);
        }
      } catch (err: any) {
        console.error("Auth fetch error:", err);
        setError(err.message || 'Error authenticating admin.');
        setAdminUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };
    fetchAdminUser();
  }, []);

  useEffect(() => {
    if (isAuthLoading || !adminUser) {
      // Don't fetch requests if auth is loading or user is not an admin (or not authenticated)
      if (!isAuthLoading && !adminUser && !error) {
        // This case means auth check finished, user is not admin, and no specific auth error was set above
        // setError might have been set to "Access Denied" already by fetchAdminUser
        if (!error) setError("Access Denied: Admin privileges required."); 
        setIsLoading(false); // Stop main loading indicator
      }
      return;
    }

    // Admin user is confirmed, proceed to fetch requests
    setIsLoading(true);
    const db = getFirestore(auth.app);
    const q = query(collection(db, 'removalRequests'), where('status', '==', 'pending'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const requests: RemovalRequest[] = [];
      querySnapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() } as RemovalRequest);
      });
      setRequests(requests.sort((a, b) => a.requestTimestamp.toMillis() - b.requestTimestamp.toMillis()));
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching pending requests: ", err);
      setError('Failed to load pending requests. Please try again later.');
      setIsLoading(false);
      toast({
        title: "Error Loading Requests",
        description: err.message,
        variant: "destructive",
      });
    });

    return () => unsubscribe();
  }, [adminUser, isAuthLoading, error]); // Added error to dependency array

  const handleApproveRequest = async (request: RemovalRequest) => {
    if (!adminUser?.uid || !adminUser?.name) {
      toast({ title: "Admin Not Authenticated", description: "Cannot process request.", variant: "destructive" });
      return;
    }

    const db = getFirestore(auth.app);
    const requestDocRef = doc(db, 'removalRequests', request.id);

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Get the latest request data (optional, but good practice if request could change)
        const requestSnapshot = await transaction.get(requestDocRef);
        if (!requestSnapshot.exists()) {
          throw new Error("Request document not found!");
        }
        const currentRequestData = requestSnapshot.data() as Omit<RemovalRequest, 'id'>;
        if (currentRequestData.status !== 'pending') {
          throw new Error(`Request is no longer pending (current status: ${currentRequestData.status}).`);
        }

        // 2. Update inventory items
        for (const itemToUpdate of request.requestedItems) {
          const inventoryItemRef = doc(db, 'inventory', itemToUpdate.itemId) as DocumentReference<InventoryItem>; // Cast for type safety
          const inventoryItemSnap = await transaction.get(inventoryItemRef);

          if (!inventoryItemSnap.exists()) {
            throw new Error(`Inventory item ${itemToUpdate.name} (ID: ${itemToUpdate.itemId}) not found!`);
          }

          const currentQuantity = inventoryItemSnap.data()?.quantity || 0;
          const newQuantity = currentQuantity - itemToUpdate.quantityToRemove;

          if (newQuantity < 0) {
            throw new Error(`Insufficient stock for ${itemToUpdate.name}. Requested: ${itemToUpdate.quantityToRemove}, Available: ${currentQuantity}.`);
          }
          transaction.update(inventoryItemRef, { quantity: newQuantity });
        }

        // 3. Update the removal request status and admin details
        transaction.update(requestDocRef, {
          status: 'approved',
          adminId: adminUser.uid,
          adminName: adminUser.name,
          processedTimestamp: serverTimestamp(),
        });

        // 4. Log the action (simplified, expand as needed based on logging standards)
        const actionLogCollection = collection(db, 'actionLogs');
        transaction.set(doc(actionLogCollection), {
          actionType: 'approve_removal_request',
          requestId: request.id,
          userId: request.userId,
          userName: request.userName,
          adminId: adminUser.uid,
          adminName: adminUser.name,
          timestamp: serverTimestamp(),
          details: {
            approvedItems: request.requestedItems,
            message: `Admin ${adminUser.name} approved removal request ${request.id} from user ${request.userName}.`
          }
        });

        // 5. Create notification for the user
        const notificationsCollection = collection(db, 'notifications');
        transaction.set(doc(notificationsCollection), { 
          userId: request.userId,
          type: 'request_approved',
          message: `Your removal request (ID: ${request.id.substring(0,6)}...) for ${request.requestedItems.length} item(s) has been approved. Inventory updated.`,
          requestId: request.id,
          timestamp: serverTimestamp(),
          isRead: false,
          link: `/notifications/${request.id}` // Correct path to the notifications detail page
        });
      });

      toast({ title: 'Request Approved', description: `Request ${request.id} processed, inventory updated, and user notified.` });
    } catch (error: any) {
      console.error("Error approving request: ", error);
      toast({ title: "Approval Error", description: error.message || "Could not approve request.", variant: "destructive" });
    }
  };

  const handleRejectRequest = async (request: RemovalRequest, rejectionNotes?: string) => {
    if (!adminUser?.uid || !adminUser?.name) {
      toast({ title: "Admin Not Authenticated", description: "Cannot process request.", variant: "destructive" });
      return;
    }

    const db = getFirestore(auth.app);
    const requestDocRef = doc(db, 'removalRequests', request.id);

    try {
      const batch = writeBatch(db);

      // 1. Update the removal request status, admin details, and notes
      batch.update(requestDocRef, {
        status: 'rejected',
        adminId: adminUser.uid,
        adminName: adminUser.name,
        processedTimestamp: serverTimestamp(),
        adminNotes: rejectionNotes || "No specific reason provided."
      });

      // 2. Log the action
      const actionLogCollection = collection(db, 'actionLogs');
      batch.set(doc(actionLogCollection), {
        actionType: 'reject_removal_request',
        requestId: request.id,
        userId: request.userId,
        userName: request.userName,
        adminId: adminUser.uid,
        adminName: adminUser.name,
        timestamp: serverTimestamp(),
        details: {
          rejectedItems: request.requestedItems,
          reason: rejectionNotes || "No specific reason provided.",
          message: `Admin ${adminUser.name} rejected removal request ${request.id} from user ${request.userName}.`
        }
      });

      // 3. Create notification for the user
      const notificationsCollection = collection(db, 'notifications');
      batch.set(doc(notificationsCollection), { 
        userId: request.userId,
        type: 'request_rejected',
        message: `Your removal request (ID: ${request.id.substring(0,6)}...) for ${request.requestedItems.length} item(s) has been rejected. Notes: ${rejectionNotes || 'N/A'}`,
        requestId: request.id,
        adminNotes: rejectionNotes || "No specific reason provided.",
        timestamp: serverTimestamp(),
        isRead: false,
        link: `/notifications/${request.id}` // Correct path to the notifications detail page
      });

      await batch.commit();
      toast({ title: 'Request Rejected', description: `Request ${request.id} has been rejected and user notified.` });
    } catch (error: any) {
      console.error("Error rejecting request: ", error);
      toast({ title: "Rejection Error", description: error.message || "Could not reject request.", variant: "destructive" });
    }
  };

  if (isAuthLoading) {
    return <p className="text-center text-lg">Authenticating admin...</p>;
  }

  if (error) {
    return <p className="text-center text-red-500 text-lg">Error: {error}</p>;
  }

  if (!adminUser) {
    // This case should ideally be caught by the error state if access is denied
    return <p className="text-center text-lg">Admin access required. Not logged in or not authorized.</p>;
  }

  if (isLoading) {
    return <p className="text-center text-lg">Loading pending requests...</p>;
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No pending removal requests at this time.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNavbar />
      <div className="container mx-auto p-4 md:p-8">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-2xl">Admin Panel: Pending Removal Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Review and process item removal requests submitted by users.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {requests.map((request) => (
          <Card key={request.id} className="shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="pb-4 bg-slate-50 dark:bg-slate-800 rounded-t-lg">
              <CardTitle className="text-lg">Request ID: <span className="font-mono text-sm bg-slate-200 dark:bg-slate-700 p-1 rounded">{request.id}</span></CardTitle>
              <div className="text-xs text-muted-foreground space-x-2">
                <span>User: {request.userName} ({request.userId})</span>
                <span>|</span>
                <span>Requested: {new Date(request.requestTimestamp.toDate()).toLocaleString()}</span>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <h4 className="font-semibold mb-2 text-md">Items Requested for Removal:</h4>
              <ul className="list-disc pl-5 space-y-2 mb-4">
                {request.requestedItems.map((item, index) => (
                  <li key={`${item.itemId}-${index}`} className="text-sm">
                    <span className="font-medium">{item.name}</span> (ID: {item.itemId})
                    <br />
                    Quantity: <span className="font-semibold">{item.quantityToRemove} {item.unit}</span>
                    {item.category && <span className="text-xs"> | Category: {item.category}</span>}
                    {/* imageUrl and link removed as per task */}
                  </li>
                ))}
              </ul>
              {request.status === 'rejected' && request.adminNotes && (
                <div className="mt-3 p-2 bg-yellow-100 border border-yellow-300 rounded-md">
                  <p className="text-sm font-semibold text-yellow-800">Admin Notes:</p>
                  <p className="text-sm text-yellow-700">{request.adminNotes}</p>
                </div>
              )}
              <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => {
                    const notes = prompt("Enter reason for rejection (optional):");
                    // Check if prompt was cancelled (null) or empty string, then proceed
                    if (notes !== null) { 
                      handleRejectRequest(request, notes);
                    }
                  }}
                >
                  Reject Request
                </Button>
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={() => handleApproveRequest(request)}
                >
                  Approve Request
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      </div>
    </div>
  );
};

export default AdminPanelPage;
