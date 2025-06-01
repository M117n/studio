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
  console.log("Current additionRequests state (PendingRequestsPanel):", additionRequests); // DEBUG
  const [activeTab, setActiveTab] = useState<'removal' | 'addition'>('removal');
  const [isLoading, setIsLoading] = useState(true); // True by default, indicates overall loading
  const [error, setError] = useState<string | null>(null);
  const { user, isAdmin, loading: authHookLoading } = useAuth(); // Use 'loading' and rename to 'authHookLoading'

  // Effect 1: Check admin status and auth state
  useEffect(() => {
    if (authHookLoading) { // Use authHookLoading
      // Auth state is still being determined
      setIsLoading(true); // Keep main loading indicator active
      return;
    }

    if (!user) {
      setError("You must be logged in to view requests.");
      setIsLoading(false);
      setRemovalRequests([]);
      setAdditionRequests([]);
      return;
    }

    if (!isAdmin) {
      setError("Access Denied: Admin privileges required.");
      setIsLoading(false);
      setRemovalRequests([]);
      setAdditionRequests([]);
      return;
    }

    // If user is admin and authenticated, clear any previous errors
    setError(null); 
    // setIsLoading(true); // Data fetching useEffect will handle this

  }, [user, isAdmin, authHookLoading]); // Depend on authHookLoading

  // Effect 2: Fetch requests (both removal and addition)
  useEffect(() => {
    // Only fetch if authenticated, confirmed as admin, and no errors
    if (authHookLoading || !isAdmin || error) { // Use authHookLoading
      // If not loading auth, not admin, or error exists, ensure main loading is off.
      if (!authHookLoading) { // Use authHookLoading
        setIsLoading(false);
      }
      // Clear data if conditions are not met to prevent showing stale data
      setRemovalRequests([]); 
      setAdditionRequests([]);
      return;
    }
    
    setIsLoading(true); // Start loading before fetching data
    const db = getFirestore(auth.app);
    
    let removalFetchAttempted = false;
    let additionFetchAttempted = false;

    const updateLoadingState = () => {
      if (removalFetchAttempted && additionFetchAttempted) {
        setIsLoading(false);
      }
    };
    
    // Fetch removal requests
    const removalQuery = query(collection(db, 'removalRequests'), where('status', '==', 'pending'));
    const unsubscribeRemoval = onSnapshot(removalQuery, (querySnapshot) => {
      const requests: RemovalRequest[] = [];
      querySnapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() } as RemovalRequest);
      });
      setRemovalRequests(requests.sort((a, b) => a.requestTimestamp.toMillis() - b.requestTimestamp.toMillis()));
      removalFetchAttempted = true;
      updateLoadingState();
    }, (err) => {
      console.error("Error fetching pending removal requests: ", err);
      toast({
        title: "Error Loading Removal Requests",
        description: err.message,
        variant: "destructive",
      });
      removalFetchAttempted = true;
      updateLoadingState();
    });
    
    // Fetch addition requests
    console.log("Setting up listener for additionRequests..."); // DEBUG
    const additionQuery = query(collection(db, 'additionRequests'), where('status', '==', 'pending'));
    const unsubscribeAddition = onSnapshot(additionQuery, (querySnapshot) => {
      console.log("additionRequests snapshot fired."); // DEBUG
      console.log("Is snapshot empty?", querySnapshot.empty); // DEBUG
      console.log("Number of docs:", querySnapshot.docs.length); // DEBUG
      const requests: AdditionRequest[] = [];
      querySnapshot.forEach((doc) => {
        console.log("Processing addition doc:", doc.id, doc.data()); // DEBUG
        requests.push({ id: doc.id, ...doc.data() } as AdditionRequest);
      });
      console.log("Fetched addition requests array:", requests); // DEBUG
      setAdditionRequests(requests.sort((a, b) => a.requestTimestamp.toMillis() - b.requestTimestamp.toMillis()));
      additionFetchAttempted = true;
      updateLoadingState();
    }, (err) => {
      console.error("Error fetching pending addition requests: ", err);
      toast({
        title: "Error Loading Addition Requests",
        description: err.message,
        variant: "destructive",
      });
      additionFetchAttempted = true;
      updateLoadingState();
    });

    return () => {
      unsubscribeRemoval();
      unsubscribeAddition();
    };
  }, [isAdmin, error, authHookLoading]); // Depend on authHookLoading

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
