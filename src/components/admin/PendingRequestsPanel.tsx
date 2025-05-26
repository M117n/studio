'use client';

import { useState, useEffect } from 'react';
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
} from 'firebase/firestore';
import { auth } from '@/lib/firebaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import type { InventoryItem } from '@/types/inventory';

// Types for requests
interface RequestedItemDetail {
  itemId: string;
  name: string;
  quantityToRemove: number;
  unit: string;
  category?: string | null;
}

interface RequestedAdditionItem {
  name: string;
  category: string;
  subcategory: string;
  quantityToAdd: number;
  unit: string;
}

interface RemovalRequest {
  id: string;
  userId: string;
  userName: string;
  requestedItems: RequestedItemDetail[];
  requestTimestamp: Timestamp;
  status: 'pending' | 'approved' | 'rejected';
  adminId?: string;
  adminName?: string;
  processedTimestamp?: Timestamp;
  adminNotes?: string;
}

interface AdditionRequest {
  id: string;
  userId: string;
  userName: string;
  requestedItem: RequestedAdditionItem;
  requestTimestamp: Timestamp;
  status: 'pending' | 'approved' | 'rejected';
  adminId?: string;
  adminName?: string;
  processedTimestamp?: Timestamp;
  adminNotes?: string;
}

interface PendingRequestsPanelProps {
  onClose?: () => void;
}

export function PendingRequestsPanel({ onClose }: PendingRequestsPanelProps) {
  const [removalRequests, setRemovalRequests] = useState<RemovalRequest[]>([]);
  const [additionRequests, setAdditionRequests] = useState<AdditionRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'removal' | 'addition'>('removal');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    // Retry mechanism for admin verification
    const checkAdminStatus = async () => {
      try {
        // Only check admin status if role is not already 'admin'
        if (isAdmin) {
          setError(null);
        } else if (user) {
          setError("Access Denied: Admin privileges required.");
        } else {
          setError("You must be logged in as an admin.");
        }
      } catch (err) {
        console.error("Error verifying admin status:", err);
        setError("Error verifying admin privileges.");
      }
    };
    
    checkAdminStatus();
  }, [isAdmin, user]);

  // Effect to fetch requests - separate from admin verification
  useEffect(() => {
    if (error) {
      // Don't fetch if we have an error
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    const db = getFirestore(auth.app);
    
    // Fetch removal requests
    const removalQuery = query(collection(db, 'removalRequests'), where('status', '==', 'pending'));
    const unsubscribeRemoval = onSnapshot(removalQuery, (querySnapshot) => {
      const requests: RemovalRequest[] = [];
      querySnapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() } as RemovalRequest);
      });
      setRemovalRequests(requests.sort((a, b) => a.requestTimestamp.toMillis() - b.requestTimestamp.toMillis()));
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching pending removal requests: ", err);
      toast({
        title: "Error Loading Removal Requests",
        description: err.message,
        variant: "destructive",
      });
    });
    
    // Fetch addition requests
    const additionQuery = query(collection(db, 'additionRequests'), where('status', '==', 'pending'));
    const unsubscribeAddition = onSnapshot(additionQuery, (querySnapshot) => {
      const requests: AdditionRequest[] = [];
      querySnapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() } as AdditionRequest);
      });
      setAdditionRequests(requests.sort((a, b) => a.requestTimestamp.toMillis() - b.requestTimestamp.toMillis()));
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching pending addition requests: ", err);
      toast({
        title: "Error Loading Addition Requests",
        description: err.message,
        variant: "destructive",
      });
    });

    return () => {
      unsubscribeRemoval();
      unsubscribeAddition();
    };
  }, [isAdmin]);

  const handleApproveRequest = async (request: RemovalRequest) => {
    if (!user?.uid) {
      toast({ title: "Not Authenticated", description: "You must be logged in as an admin to approve requests.", variant: "destructive" });
      return;
    }

    const adminName = user.displayName || user.email || 'Admin User';
    const adminId = user.uid;

    const db = getFirestore(auth.app);
    const requestDocRef = doc(db, 'removalRequests', request.id);

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Get the latest request data
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
          const inventoryItemRef = doc(db, 'inventory', itemToUpdate.itemId) as DocumentReference<InventoryItem>;
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
          adminId,
          adminName,
          processedTimestamp: serverTimestamp(),
        });

        // 4. Log the action
        const actionLogCollection = collection(db, 'actionLogs');
        transaction.set(doc(actionLogCollection), {
          actionType: 'approve_removal_request',
          requestId: request.id,
          userId: request.userId,
          userName: request.userName,
          adminId,
          adminName,
          timestamp: serverTimestamp(),
          details: {
            approvedItems: request.requestedItems,
            message: `Admin ${adminName} approved removal request ${request.id} from user ${request.userName}.`
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
          link: `/user/requests/${request.id}`
        });
      });

      toast({ title: 'Request Approved', description: `Request ${request.id.substring(0,6)}... processed, inventory updated, and user notified.` });
    } catch (error: any) {
      console.error("Error approving request: ", error);
      toast({ title: "Approval Error", description: error.message || "Could not approve request.", variant: "destructive" });
    }
  };

  const handleRejectRequest = async (request: RemovalRequest, rejectionNotes?: string) => {
    if (!user?.uid) {
      toast({ title: "Not Authenticated", description: "You must be logged in as an admin to reject requests.", variant: "destructive" });
      return;
    }

    const adminName = user.displayName || user.email || 'Admin User';
    const adminId = user.uid;

    const db = getFirestore(auth.app);
    const requestDocRef = doc(db, 'removalRequests', request.id);

    try {
      const batch = writeBatch(db);

      // 1. Update the removal request status, admin details, and notes
      batch.update(requestDocRef, {
        status: 'rejected',
        adminId,
        adminName,
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
        adminId,
        adminName,
        timestamp: serverTimestamp(),
        details: {
          rejectedItems: request.requestedItems,
          reason: rejectionNotes || "No specific reason provided.",
          message: `Admin ${adminName} rejected removal request ${request.id} from user ${request.userName}.`
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
        link: `/user/requests/${request.id}`
      });

      await batch.commit();
      toast({ title: 'Request Rejected', description: `Request ${request.id.substring(0,6)}... has been rejected and user notified.` });
    } catch (error: any) {
      console.error("Error rejecting request: ", error);
      toast({ title: "Rejection Error", description: error.message || "Could not reject request.", variant: "destructive" });
    }
  };

  // Function to handle approving an item addition request
  const handleApproveAdditionRequest = async (request: AdditionRequest) => {
    if (!user?.uid) {
      toast({ title: "Not Authenticated", description: "You must be logged in as an admin to approve requests.", variant: "destructive" });
      return;
    }

    const adminName = user.displayName || user.email || 'Admin User';
    const adminId = user.uid;

    const db = getFirestore(auth.app);
    const requestDocRef = doc(db, 'additionRequests', request.id);

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Get the latest request data
        const requestSnapshot = await transaction.get(requestDocRef);
        if (!requestSnapshot.exists()) {
          throw new Error("Request document not found!");
        }
        const currentRequestData = requestSnapshot.data() as Omit<AdditionRequest, 'id'>;
        if (currentRequestData.status !== 'pending') {
          throw new Error(`Request is no longer pending (current status: ${currentRequestData.status}).`);
        }

        // 2. Add the new item to inventory
        const { name, category, subcategory, quantityToAdd, unit } = request.requestedItem;
        const inventoryCollectionRef = collection(db, 'inventory');
        const newItemRef = doc(inventoryCollectionRef);
        
        transaction.set(newItemRef, {
          name,
          category,
          subcategory,
          quantity: quantityToAdd,
          unit,
        });

        // 3. Update the addition request status and admin details
        transaction.update(requestDocRef, {
          status: 'approved',
          adminId,
          adminName,
          processedTimestamp: serverTimestamp(),
        });

        // 4. Log the action
        const actionLogCollection = collection(db, 'actionLogs');
        transaction.set(doc(actionLogCollection), {
          actionType: 'approve_addition_request',
          requestId: request.id,
          userId: request.userId,
          userName: request.userName,
          adminId,
          adminName,
          timestamp: serverTimestamp(),
          details: {
            approvedItem: request.requestedItem,
            message: `Admin ${adminName} approved item addition request ${request.id} from user ${request.userName}.`
          }
        });

        // 5. Create notification for the user
        const notificationsCollection = collection(db, 'notifications');
        transaction.set(doc(notificationsCollection), { 
          userId: request.userId,
          type: 'request_approved',
          message: `Your item addition request (ID: ${request.id.substring(0,6)}...) for ${request.requestedItem.name} has been approved. Inventory updated.`,
          requestId: request.id,
          timestamp: serverTimestamp(),
          isRead: false,
          link: `/user/requests/${request.id}`
        });
      });

      toast({ title: 'Request Approved', description: `Addition request ${request.id.substring(0,6)}... processed, inventory updated, and user notified.` });
    } catch (error: any) {
      console.error("Error approving addition request: ", error);
      toast({ title: "Approval Error", description: error.message || "Could not approve request.", variant: "destructive" });
    }
  };

  // Function to handle rejecting an item addition request
  const handleRejectAdditionRequest = async (request: AdditionRequest, rejectionNotes?: string) => {
    if (!user?.uid) {
      toast({ title: "Not Authenticated", description: "You must be logged in as an admin to reject requests.", variant: "destructive" });
      return;
    }

    const adminName = user.displayName || user.email || 'Admin User';
    const adminId = user.uid;

    const db = getFirestore(auth.app);
    const requestDocRef = doc(db, 'additionRequests', request.id);

    try {
      const batch = writeBatch(db);

      // 1. Update the addition request status, admin details, and notes
      batch.update(requestDocRef, {
        status: 'rejected',
        adminId,
        adminName,
        processedTimestamp: serverTimestamp(),
        adminNotes: rejectionNotes || "No specific reason provided."
      });

      // 2. Log the action
      const actionLogCollection = collection(db, 'actionLogs');
      batch.set(doc(actionLogCollection), {
        actionType: 'reject_addition_request',
        requestId: request.id,
        userId: request.userId,
        userName: request.userName,
        adminId,
        adminName,
        timestamp: serverTimestamp(),
        details: {
          rejectedItem: request.requestedItem,
          reason: rejectionNotes || "No specific reason provided.",
          message: `Admin ${adminName} rejected item addition request ${request.id} from user ${request.userName}.`
        }
      });

      // 3. Create notification for the user
      const notificationsCollection = collection(db, 'notifications');
      batch.set(doc(notificationsCollection), { 
        userId: request.userId,
        type: 'request_rejected',
        message: `Your item addition request (ID: ${request.id.substring(0,6)}...) for ${request.requestedItem.name} has been rejected. Notes: ${rejectionNotes || 'N/A'}`,
        requestId: request.id,
        adminNotes: rejectionNotes || "No specific reason provided.",
        timestamp: serverTimestamp(),
        isRead: false,
        link: `/user/requests/${request.id}`
      });

      await batch.commit();
      toast({ title: 'Request Rejected', description: `Addition request ${request.id.substring(0,6)}... has been rejected and user notified.` });
    } catch (error: any) {
      console.error("Error rejecting addition request: ", error);
      toast({ title: "Rejection Error", description: error.message || "Could not reject request.", variant: "destructive" });
    }
  };
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="w-full">
            <CardHeader>
              <Skeleton className="h-4 w-1/3" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="pt-6">
          <p className="text-center text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const hasNoRemovalRequests = removalRequests.length === 0;
  const hasNoAdditionRequests = additionRequests.length === 0;
  const hasNoRequests = hasNoRemovalRequests && hasNoAdditionRequests;

  // Tab buttons for switching between removal and addition requests
  const RequestTabs = () => (
    <div className="flex space-x-2 mb-6">
      <Button
        variant={activeTab === 'removal' ? 'default' : 'outline'}
        onClick={() => setActiveTab('removal')}
        className="flex-1"
      >
        Removal Requests
        {removalRequests.length > 0 && (
          <span className="ml-2 bg-primary-foreground text-primary px-2 py-1 rounded-full text-xs">
            {removalRequests.length}
          </span>
        )}
      </Button>
      <Button
        variant={activeTab === 'addition' ? 'default' : 'outline'}
        onClick={() => setActiveTab('addition')}
        className="flex-1"
      >
        Addition Requests
        {additionRequests.length > 0 && (
          <span className="ml-2 bg-primary-foreground text-primary px-2 py-1 rounded-full text-xs">
            {additionRequests.length}
          </span>
        )}
      </Button>
    </div>
  );

  if (hasNoRequests) {
    return (
      <div>
        <RequestTabs />
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No pending requests at this time.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <RequestTabs />
      
      {/* Removal Requests Tab */}
      {activeTab === 'removal' && (
        <div className="space-y-6">
          {hasNoRemovalRequests ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">No pending removal requests at this time.</p>
              </CardContent>
            </Card>
          ) : (
            removalRequests.map((request) => (
              <Card key={request.id} className="shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="pb-4 bg-slate-50 dark:bg-slate-800 rounded-t-lg">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>Removal Request <span className="font-mono text-sm bg-slate-200 dark:bg-slate-700 p-1 rounded">{request.id.substring(0,8)}...</span></span>
                    <span className="text-xs text-muted-foreground">{new Date(request.requestTimestamp.toDate()).toLocaleString()}</span>
                  </CardTitle>
                  <div className="text-xs text-muted-foreground">
                    <span>From: {request.userName}</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <h4 className="font-semibold mb-2 text-md">Items Requested for Removal:</h4>
                  <ul className="list-disc pl-5 space-y-2 mb-4">
                    {request.requestedItems.map((item, index) => (
                      <li key={`${item.itemId}-${index}`} className="text-sm">
                        <span className="font-medium">{item.name}</span>
                        <br />
                        Quantity: <span className="font-semibold">{item.quantityToRemove} {item.unit}</span>
                        {item.category && <span className="text-xs ml-2">(Category: {item.category})</span>}
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => {
                        const notes = prompt("Enter reason for rejection (optional):");
                        if (notes !== null) { 
                          handleRejectRequest(request, notes);
                        }
                      }}
                    >
                      Reject
                    </Button>
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={() => handleApproveRequest(request)}
                    >
                      Approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
      
      {/* Addition Requests Tab */}
      {activeTab === 'addition' && (
        <div className="space-y-6">
          {hasNoAdditionRequests ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">No pending addition requests at this time.</p>
              </CardContent>
            </Card>
          ) : (
            additionRequests.map((request) => (
              <Card key={request.id} className="shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="pb-4 bg-green-50 dark:bg-green-950 rounded-t-lg">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>Addition Request <span className="font-mono text-sm bg-green-200 dark:bg-green-900 p-1 rounded">{request.id.substring(0,8)}...</span></span>
                    <span className="text-xs text-muted-foreground">{new Date(request.requestTimestamp.toDate()).toLocaleString()}</span>
                  </CardTitle>
                  <div className="text-xs text-muted-foreground">
                    <span>From: {request.userName}</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <h4 className="font-semibold mb-2 text-md">Item Requested for Addition:</h4>
                  <div className="bg-slate-50 p-4 rounded-md">
                    <p className="font-medium text-lg">{request.requestedItem.name}</p>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Quantity: </span>
                        <span className="font-semibold">{request.requestedItem.quantityToAdd} {request.requestedItem.unit}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Category: </span>
                        <span>{request.requestedItem.category} / {request.requestedItem.subcategory}</span>
                      </div>

                    </div>
                  </div>
                  <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => {
                        const notes = prompt("Enter reason for rejection (optional):");
                        if (notes !== null) { 
                          handleRejectAdditionRequest(request, notes);
                        }
                      }}
                    >
                      Reject
                    </Button>
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={() => handleApproveAdditionRequest(request)}
                    >
                      Approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
