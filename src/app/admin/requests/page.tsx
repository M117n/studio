// src/app/admin/requests/page.tsx
"use client";

import { AdminNavbar } from '@/components/AdminNavbar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { useEffect, useState } from 'react';
import {
  getFirestore, collection, query, where, onSnapshot, doc, runTransaction, serverTimestamp, writeBatch, addDoc, Timestamp, DocumentReference, getDoc, getDocs
} from 'firebase/firestore';
import { auth } from '@/lib/firebaseClient'; 
import { useAuth } from '@/hooks/useAuth'; 
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast"; 
import { InventoryItem, Category, SubCategory, Unit, isValidCategory, isValidSubCategory, isValidUnit } from '@/types/inventory'; 
import { convertUnits, NON_CONVERTIBLE_UNITS } from '@/lib/unitConversion';

// Define a more specific type for the items within a removal request
interface RequestedItemDetail {
  itemId: string;
  name: string;
  quantityToRemove: number;
  unit: Unit;
  category: Category | null;
  subcategory: SubCategory | null;
}

// Define the structure of a removal request as fetched from Firestore
export interface RemovalRequest {
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

// Define the structure of an addition request as fetched from Firestore
export interface AdditionRequest {
  id: string;
  userId: string;
  userName: string;
  requestedItems?: {
    name: string;
    category: Category;
    subcategory: SubCategory;
    quantityToAdd: number;
    unit: Unit;
  }[];
  requestedItem?: {
    name: string;
    category: Category;
    subcategory: SubCategory;
    quantityToAdd: number;
    unit: Unit;
  };
  requestTimestamp: Timestamp;
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

interface ApprovalAction {
  type: 'create' | 'update';
  docId: string;
  item: { name: string; category: Category; subcategory: SubCategory; quantityToAdd: number; unit: Unit; };
  existingData?: InventoryItem;
}

const AdminPanelPage = () => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<RemovalRequest[]>([]);
  const [additionRequests, setAdditionRequests] = useState<AdditionRequest[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUserData | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('removal');
  const [conflict, setConflict] = useState<{
    request: AdditionRequest;
    item: { name: string; category: Category; subcategory: SubCategory; quantityToAdd: number; unit: Unit; };
    existingUnit: Unit;
    existingDocId: string;
  } | null>(null);

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
          setAdminUser(null); 
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
      if (!isAuthLoading && !adminUser && !error) {
        if (!error) setError("Access Denied: Admin privileges required."); 
        setIsLoading(false); 
      }
      return;
    }

    setIsLoading(true);
    const db = getFirestore(auth.app);
    
    let removalFetchAttempted = false;
    let additionFetchAttempted = false;

    const updateLoadingState = () => {
      if (removalFetchAttempted && additionFetchAttempted) {
        setIsLoading(false);
      }
    };

    const removalQuery = query(collection(db, 'removalRequests'), where('status', '==', 'pending'));
    const unsubscribeRemoval = onSnapshot(removalQuery, (querySnapshot) => {
      const fetchedRequests: RemovalRequest[] = [];
      querySnapshot.forEach((doc) => {
        fetchedRequests.push({ id: doc.id, ...doc.data() } as RemovalRequest);
      });
      setRequests(fetchedRequests.sort((a, b) => a.requestTimestamp.toMillis() - b.requestTimestamp.toMillis()));
      removalFetchAttempted = true;
      updateLoadingState();
    }, (err) => {
      console.error("Error fetching pending removal requests: ", err);
      toast({ title: "Error Loading Removal Requests", description: err.message, variant: "destructive" });
      removalFetchAttempted = true;
      updateLoadingState();
    });

    const additionQuery = query(collection(db, 'additionRequests'), where('status', '==', 'pending'));
    const unsubscribeAddition = onSnapshot(additionQuery, (querySnapshot) => {
      const fetchedRequests: AdditionRequest[] = [];
      querySnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();

        if (Array.isArray(data.requestedItems)) {
          const validatedItems: NonNullable<AdditionRequest['requestedItems']> = [];
          for (const itemData of data.requestedItems) {
            const categoryStr = itemData.category;
            const subcategoryStr = itemData.subcategory;
            const unitStr = itemData.unit;

            if (!isValidCategory(categoryStr) || !isValidSubCategory(subcategoryStr) || !isValidUnit(unitStr)) {
              console.error(`Invalid item data in addition request ${docSnapshot.id}.`);
              toast({ title: "Data Error", description: `Request ${docSnapshot.id} has invalid item data`, variant: "destructive" });
              return;
            }
            validatedItems.push({
              name: itemData.name,
              category: categoryStr,
              subcategory: subcategoryStr,
              quantityToAdd: itemData.quantityToAdd,
              unit: unitStr,
            });
          }
          fetchedRequests.push({
            id: docSnapshot.id,
            userId: data.userId,
            userName: data.userName,
            requestTimestamp: data.requestTimestamp as Timestamp,
            status: data.status as 'pending' | 'approved' | 'rejected',
            adminId: data.adminId,
            adminName: data.adminName,
            processedTimestamp: data.processedTimestamp as Timestamp | undefined,
            adminNotes: data.adminNotes,
            requestedItems: validatedItems,
          });
        } else if (data.requestedItem) {
          const itemData = data.requestedItem;
          const categoryStr = itemData.category;
          const subcategoryStr = itemData.subcategory;
          const unitStr = itemData.unit;

          if (!isValidCategory(categoryStr) || !isValidSubCategory(subcategoryStr) || !isValidUnit(unitStr)) {
            console.error(`Invalid item data in addition request ${docSnapshot.id}.`);
            toast({ title: "Data Error", description: `Request ${docSnapshot.id} has invalid item data`, variant: "destructive" });
            return;
          }

          fetchedRequests.push({
            id: docSnapshot.id,
            userId: data.userId,
            userName: data.userName,
            requestTimestamp: data.requestTimestamp as Timestamp,
            status: data.status as 'pending' | 'approved' | 'rejected',
            adminId: data.adminId,
            adminName: data.adminName,
            processedTimestamp: data.processedTimestamp as Timestamp | undefined,
            adminNotes: data.adminNotes,
            requestedItem: {
              name: itemData.name,
              category: categoryStr,
              subcategory: subcategoryStr,
              quantityToAdd: itemData.quantityToAdd,
              unit: unitStr,
            },
          });
        } else {
          console.error(`Addition request ${docSnapshot.id} missing item data.`);
        }
      });
      setAdditionRequests(fetchedRequests.sort((a, b) => a.requestTimestamp.toMillis() - b.requestTimestamp.toMillis()));
      additionFetchAttempted = true;
      updateLoadingState();
    }, (err) => {
      console.error("Error fetching pending addition requests: ", err);
      toast({ title: "Error Loading Addition Requests", description: err.message, variant: "destructive" });
      additionFetchAttempted = true;
      updateLoadingState();
    });

    return () => {
      unsubscribeRemoval();
      unsubscribeAddition();
    };
  }, [isAuthLoading, adminUser, error]);

  const handleApproveRequest = async (request: RemovalRequest) => {
    if (!adminUser?.uid || !adminUser?.name) {
      toast({ title: "Error", description: "Admin user data not found. Cannot process request.", variant: "destructive" });
      return;
    }

    const db = getFirestore(auth.app);

    try {
      await runTransaction(db, async (transaction) => {
        const requestDocRef = doc(db, 'removalRequests', request.id);
        transaction.update(requestDocRef, {
          status: 'approved',
          adminId: adminUser.uid,
          adminName: adminUser.name,
          processedTimestamp: serverTimestamp(),
        });

        for (const item of request.requestedItems) {
          const inventoryItemRef = doc(db, 'inventory', item.itemId) as DocumentReference<InventoryItem>; 
          const inventoryItemSnap = await transaction.get(inventoryItemRef);

          if (!inventoryItemSnap.exists()) {
            throw new Error(`Inventory item with ID ${item.itemId} not found.`);
          }

          const currentQuantity = inventoryItemSnap.data().quantity;
          const newQuantity = currentQuantity - item.quantityToRemove;

          if (newQuantity < 0) {
            throw new Error(`Not enough stock for item ${item.name} (ID: ${item.itemId}). Requested: ${item.quantityToRemove}, Available: ${currentQuantity}`);
          }

          transaction.update(inventoryItemRef, { 
            quantity: newQuantity,
            lastUpdated: serverTimestamp()
          });
        }

        const actionLogRef = collection(db, 'actionLogs');
        await addDoc(actionLogRef, {
          actionType: 'approve_removal_request',
          requestId: request.id,
          userId: request.userId,
          userName: request.userName,
          adminId: adminUser.uid,
          adminName: adminUser.name,
          timestamp: serverTimestamp(),
          details: {
            approvedItems: request.requestedItems,
            message: `Admin ${adminUser.name} approved removal request ${request.id} from user ${request.userName}.`,
          },
        });

        const notificationsRef = collection(db, 'notifications');
        const notificationMessage = request.requestedItems.length > 1
          ? `Your removal request for ${request.requestedItems.length} items has been approved.`
          : `Your removal request for ${request.requestedItems[0].quantityToRemove}x ${request.requestedItems[0].name} has been approved.`;

        await addDoc(notificationsRef, {
          userId: request.userId,
          type: 'request_approved',
          message: notificationMessage,
          requestId: request.id,
          timestamp: serverTimestamp(),
          isRead: false,
          link: `/notifications/${request.id}`,
          approvedItems: request.requestedItems.map(item => ({
            name: item.name,
            quantity: item.quantityToRemove,
            unit: item.unit
          }))
        });
      });

      toast({
        title: "Request Approved",
        description: `Removal request ${request.id} has been approved and inventory updated.`,
      });
    } catch (e: any) {
      console.error("Error approving request: ", e);
      toast({
        title: "Error Approving Request",
        description: e.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  const handleRejectRequest = async (request: RemovalRequest, rejectionNotes?: string) => {
    if (!adminUser?.uid || !adminUser?.name) {
      toast({ title: "Admin Not Authenticated", description: "Cannot process request.", variant: "destructive" });
      return;
    }

    const db = getFirestore(auth.app);
    const requestDocRef = doc(db, 'removalRequests', request.id);
    const batch = writeBatch(db);

    batch.update(requestDocRef, {
      status: 'rejected',
      adminId: adminUser.uid,
      adminName: adminUser.name,
      processedTimestamp: serverTimestamp(),
      adminNotes: rejectionNotes || "No specific reason provided."
    });

    const actionLogRef = doc(collection(db, 'actionLogs'));
    batch.set(actionLogRef, {
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

    const notificationRef = doc(collection(db, 'notifications'));
    batch.set(notificationRef, { 
      userId: request.userId,
      type: 'request_rejected',
      message: `Your removal request (ID: ${request.id.substring(0,6)}...) for ${request.requestedItems.length} item(s) has been rejected. Notes: ${rejectionNotes || 'N/A'}`, 
      requestId: request.id,
      adminNotes: rejectionNotes || "No specific reason provided.",
      timestamp: serverTimestamp(),
      isRead: false,
      link: `/notifications/${request.id}` 
    });

    try {
      await batch.commit();
      toast({ title: 'Request Rejected', description: `Request ${request.id} has been rejected and user notified.` });
    } catch (error: any) {
      console.error("Error rejecting request: ", error);
      toast({ title: "Rejection Error", description: error.message || "Could not reject request.", variant: "destructive" });
    }
  };

  const executeApproveAddition = async (request: AdditionRequest, actions: ApprovalAction[], resolutions: { [itemName: string]: Unit } = {}) => {
    if (!adminUser?.uid || !adminUser?.name) {
      toast({ title: "Error", description: "Admin user data not found.", variant: "destructive" });
      return;
    }
    const db = getFirestore(auth.app);

    try {
      await runTransaction(db, async (transaction) => {
        const requestRef = doc(db, 'additionRequests', request.id);
        transaction.update(requestRef, {
          status: 'approved',
          adminId: adminUser.uid,
          adminName: adminUser.name,
          processedTimestamp: serverTimestamp(),
        });

        for (const action of actions) {
          const itemRef = doc(db, 'inventory', action.docId);

          if (action.type === 'update') {
            if (!action.existingData) {
              console.error("Critical error: Update action is missing existing data for item:", action.item.name);
              throw new Error("Invalid action state: existingData is missing for an update.");
            }
            const existingItemData = action.existingData;
            let quantityToAdd = action.item.quantityToAdd;
            let finalUnit = existingItemData.unit;
            const updateData: { [key: string]: any } = {};

            // Add normalizedName if it's missing (progressive migration)
            if (!existingItemData.normalizedName) {
              updateData.normalizedName = action.item.name.trim().toLowerCase();
            }

            // Apply resolution from conflict dialog if it exists
            if (resolutions[action.item.name]) {
              finalUnit = resolutions[action.item.name];
            } else if (existingItemData.unit !== action.item.unit) {
              // Otherwise, convert if possible (pre-check confirmed it's convertible)
              const convertedQuantity = convertUnits(action.item.quantityToAdd, action.item.unit, existingItemData.unit);
              quantityToAdd = convertedQuantity!;
            }

            updateData.quantity = existingItemData.quantity + quantityToAdd;
            updateData.unit = finalUnit;
            updateData.lastUpdated = serverTimestamp();

            transaction.update(itemRef, updateData);

          } else { // action.type === 'create'
            const newItemData: Omit<InventoryItem, 'id'> = {
              name: action.item.name.trim(),
              normalizedName: action.item.name.trim().toLowerCase(),
              category: action.item.category,
              subcategory: action.item.subcategory,
              quantity: action.item.quantityToAdd,
              unit: action.item.unit,
              lastUpdated: serverTimestamp() as Timestamp,
            };
            transaction.set(itemRef, newItemData);
          }
        }

        const actionLogRef = collection(db, 'actionLogs');
        transaction.set(doc(actionLogRef), {
          actionType: 'approve_addition_request',
          requestId: request.id,
          userId: request.userId,
          userName: request.userName,
          adminId: adminUser.uid,
          adminName: adminUser.name,
          timestamp: serverTimestamp(),
          details: {
            approvedItems: actions.map(action => action.item),
            message: `Admin ${adminUser.name} approved addition request ${request.id}.`
          },
        });

        const notificationsRef = collection(db, 'notifications');
        transaction.set(doc(notificationsRef), {
          userId: request.userId,
          type: 'request_approved',
          message: `Your addition request for '${actions.map(action => action.item.name).join(', ')}' has been approved.`,
          requestId: request.id,
          timestamp: serverTimestamp(),
          isRead: false,
          link: `/notifications/${request.id}`
        });
      });

      toast({ title: "Addition Request Approved", description: `Request ${request.id} has been approved.` });
      if (conflict) setConflict(null); // Close dialog

    } catch (e: any) {
      console.error("Error approving addition request: ", e);
      toast({ title: "Error Approving Request", description: e.message, variant: "destructive" });
    }
  };

  const handleApproveAdditionRequest = async (request: AdditionRequest) => {
    if (!adminUser?.uid) return;
    const db = getFirestore(auth.app);
    const inventoryRef = collection(db, 'inventory');

    try {
      const itemsToAdd = request.requestedItems ?? (request.requestedItem ? [request.requestedItem] : []);
      const actions: ApprovalAction[] = [];

      for (const item of itemsToAdd) {
        if (!item) continue;

        const trimmedName = item.name.trim();
        const normalizedName = trimmedName.toLowerCase();
        let existingDocId: string | null = null;
        let existingData: InventoryItem | null = null;

        // Step 1: Query by normalizedName for case-insensitive matching.
        const normalizedQuery = query(inventoryRef, where("normalizedName", "==", normalizedName));
        const normalizedSnapshot = await getDocs(normalizedQuery);

        if (!normalizedSnapshot.empty) {
          const doc = normalizedSnapshot.docs[0];
          existingDocId = doc.id;
          existingData = doc.data() as InventoryItem;
        } else {
          // Step 2: If not found, query by exact name for backward compatibility.
          const legacyQuery = query(inventoryRef, where("name", "==", trimmedName));
          const legacySnapshot = await getDocs(legacyQuery);
          if (!legacySnapshot.empty) {
            const doc = legacySnapshot.docs[0];
            existingDocId = doc.id;
            existingData = doc.data() as InventoryItem;
          }
        }

        if (existingDocId && existingData) {
          // Item exists, check for unit mismatches
          if (existingData.unit !== item.unit) {
            const convertedQuantity = convertUnits(item.quantityToAdd, item.unit, existingData.unit);
            if (convertedQuantity === null) {
              // Non-convertible conflict: open dialog and stop.
              setConflict({ request, item, existingUnit: existingData.unit, existingDocId });
              return;
            }
          }
          actions.push({ type: 'update', docId: existingDocId, item, existingData });
        } else {
          // Item is new, create it with a predictable ID from its normalized name.
          const predictableId = normalizedName.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
          actions.push({ type: 'create', docId: predictableId, item });
        }
      }

      // If we get here, no conflicts were found. Proceed with approval.
      await executeApproveAddition(request, actions);

    } catch (e: any) {
      console.error("Error during pre-check: ", e);
      toast({ title: "Error Checking Request", description: e.message, variant: "destructive" });
    }
  };

  const handleConflictResolution = async (chosenUnit: Unit) => {
    if (!conflict) return;
    
    const { request, item, existingDocId } = conflict;
    const resolutions = { [item.name]: chosenUnit };
    
    setConflict(null); // Close dialog

    // To handle the rest of the items in the request correctly, we must re-run the full pre-check.
    const db = getFirestore(auth.app);
    const inventoryRef = collection(db, 'inventory');
    const itemsToAdd = request.requestedItems ?? (request.requestedItem ? [request.requestedItem] : []);
    const actions: ApprovalAction[] = [];

    try {
      for (const currentItem of itemsToAdd) {
        if (!currentItem) continue;

        const trimmedName = currentItem.name.trim();
        const normalizedName = trimmedName.toLowerCase();
        let otherExistingDocId: string | null = null;
        let otherExistingData: InventoryItem | null = null;

        // If this is the item we just resolved, we already know its ID and data.
        if (currentItem.name === item.name) {
          otherExistingDocId = existingDocId;
          // We need to fetch the latest data to be safe in the transaction
          const docSnap = await getDoc(doc(db, 'inventory', existingDocId));
          if (docSnap.exists()) {
            otherExistingData = docSnap.data() as InventoryItem;
          }
        } else {
          // Pre-check logic for other items in the request
          const normalizedQuery = query(inventoryRef, where("normalizedName", "==", normalizedName));
          const normalizedSnapshot = await getDocs(normalizedQuery);
          if (!normalizedSnapshot.empty) {
            const doc = normalizedSnapshot.docs[0];
            otherExistingDocId = doc.id;
            otherExistingData = doc.data() as InventoryItem;
          } else {
            const legacyQuery = query(inventoryRef, where("name", "==", trimmedName));
            const legacySnapshot = await getDocs(legacyQuery);
            if (!legacySnapshot.empty) {
              const doc = legacySnapshot.docs[0];
              otherExistingDocId = doc.id;
              otherExistingData = doc.data() as InventoryItem;
            }
          }
        }

        if (otherExistingDocId && otherExistingData) {
          // For the resolved item, we don't need to check for conflicts again.
          // For other items, we assume they passed the initial check.
          actions.push({ type: 'update', docId: otherExistingDocId, item: currentItem, existingData: otherExistingData });
        } else {
          const predictableId = normalizedName.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
          actions.push({ type: 'create', docId: predictableId, item: currentItem });
        }
      }

      await executeApproveAddition(request, actions, resolutions);

    } catch (e: any) {
      console.error("Error during conflict resolution pre-check: ", e);
      toast({ title: "Error Resolving Conflict", description: e.message, variant: "destructive" });
    }
  };

  const handleRejectAdditionRequest = async (request: AdditionRequest, rejectionNotes?: string) => {
    if (!adminUser?.uid || !adminUser?.name) {
      toast({ title: "Error", description: "Admin user data not found. Cannot process request.", variant: "destructive" });
      return;
    }

    const db = getFirestore(auth.app);
    const requestRef = doc(db, 'additionRequests', request.id);
    const batch = writeBatch(db);

    batch.update(requestRef, {
      status: 'rejected',
      adminId: adminUser.uid,
      adminName: adminUser.name,
      processedTimestamp: serverTimestamp(),
      adminNotes: rejectionNotes || "No specific reason provided."
    });

    const actionLogRef = doc(collection(db, 'actionLogs'));
    batch.set(actionLogRef, {
      actionType: 'reject_addition_request',
      requestId: request.id,
      userId: request.userId,
      userName: request.userName,
      adminId: adminUser.uid,
      adminName: adminUser.name,
      timestamp: serverTimestamp(),
      details: {
        rejectedItems: request.requestedItems ?? [request.requestedItem],
        reason: rejectionNotes || "No specific reason provided.",
        message: `Rejected addition request ${request.id}.`,
      },
    });

    const notificationRef = doc(collection(db, 'notifications'));
    batch.set(notificationRef, {
      userId: request.userId,
      type: 'request_rejected',
      message: `Your addition request ${request.id.substring(0,6)}... was rejected.`,
      requestId: request.id,
      adminNotes: rejectionNotes,
      timestamp: serverTimestamp(),
      isRead: false,
    });

    try {
      await batch.commit();
      toast({
        title: "Addition Request Rejected",
        description: `Addition request ${request.id} has been rejected.`,
        variant: "default",
      });
    } catch (e: any) {
      console.error("Error rejecting addition request: ", e);
      toast({
        title: "Error Rejecting Request",
        description: e.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  if (isAuthLoading) {
    return <p className="text-center text-lg">Authenticating admin...</p>;
  }

  if (error) {
    return <p className="text-center text-red-500 text-lg">Error: {error}</p>;
  }

  if (!adminUser) {
    return <p className="text-center text-lg">Admin access required. Not logged in or not authorized.</p>;
  }

  if (isLoading) { 
    return <p className="text-center text-lg">Loading pending requests...</p>;
  }

  const noRemovalRequests = requests.length === 0;
  const noAdditionRequests = additionRequests.length === 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNavbar />
      <div className="container mx-auto p-4 md:p-8">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">Admin Panel: Pending Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Review and process item removal and addition requests submitted by users.
            </p>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="removal">Removal Requests ({requests.length})</TabsTrigger>
            <TabsTrigger value="addition">Addition Requests ({additionRequests.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="removal">
            {noRemovalRequests ? (
              <Card className="mt-4">
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">No pending removal requests at this time.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6 mt-4">
                {requests.map((request) => (
                  <Card key={request.id} className="shadow-md hover:shadow-lg transition-shadow duration-200">
                    <CardHeader className="pb-4 bg-slate-50 dark:bg-slate-800 rounded-t-lg">
                      <CardTitle className="text-lg">Request ID: <span className="font-mono text-sm bg-slate-200 dark:bg-slate-700 p-1 rounded">{request.id.substring(0,8)}...</span></CardTitle>
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
            )}
          </TabsContent>

          <TabsContent value="addition">
            {noAdditionRequests ? (
              <Card className="mt-4">
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">No pending addition requests at this time.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6 mt-4">
                {additionRequests.map((request) => (
                  <Card key={request.id} className="shadow-md hover:shadow-lg transition-shadow duration-200">
                    <CardHeader className="pb-4 bg-green-50 dark:bg-green-950 rounded-t-lg">
                      <CardTitle className="text-lg">Addition Request ID: <span className="font-mono text-sm bg-green-200 dark:bg-green-900 p-1 rounded">{request.id.substring(0,8)}...</span></CardTitle>
                      <div className="text-xs text-muted-foreground space-x-2">
                        <span>User: {request.userName} ({request.userId})</span>
                        <span>|</span>
                        <span>Requested: {new Date(request.requestTimestamp.toDate()).toLocaleString()}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {request.requestedItems ? (
                        <div>
                          <h4 className="font-semibold mb-2 text-md">Items Requested for Addition:</h4>
                          <ul className="space-y-2">
                            {request.requestedItems.map((item, idx) => (
                              <li key={idx} className="bg-slate-50 p-3 rounded-md border">
                                <p className="font-medium text-md">{item.name}</p>
                                <div className="grid grid-cols-2 gap-1 mt-1 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Quantity: </span>
                                    <span className="font-semibold">{item.quantityToAdd} {item.unit}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Category: </span>
                                    <span>{item.category}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Subcategory: </span>
                                    <span>{item.subcategory}</span>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div>
                          <h4 className="font-semibold mb-2 text-md">Item Requested for Addition:</h4>
                          <div className="bg-slate-50 p-3 rounded-md border">
                            <p className="font-medium text-md">{request.requestedItem?.name}</p>
                            <div className="grid grid-cols-2 gap-1 mt-1 text-sm">
                              <div>
                                <span className="text-muted-foreground">Quantity: </span>
                                <span className="font-semibold">{request.requestedItem?.quantityToAdd} {request.requestedItem?.unit}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Category: </span>
                                <span>{request.requestedItem?.category}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Subcategory: </span>
                                <span>{request.requestedItem?.subcategory}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
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
                            if (notes !== null) { 
                              handleRejectAdditionRequest(request, notes);
                            }
                          }}
                        >
                          Reject Addition
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={() => handleApproveAdditionRequest(request)}
                        >
                          Approve Addition
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Unit Conflict Resolution Dialog */}
        {conflict && (
          <Dialog open={!!conflict} onOpenChange={() => setConflict(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Unit Conversion Conflict</DialogTitle>
                <DialogDescription className="pt-2">
                  The item "<span className="font-bold">{conflict.item.name}</span>" exists as "<span className="font-bold">{conflict.existingUnit}</span>", but the request is to add "<span className="font-bold">{conflict.item.unit}</span>". These units cannot be converted automatically.
                  <br /><br />
                  Please choose which unit to use for this item. The quantities will be summed directly.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConflict(null)}>Cancel</Button>
                <Button onClick={() => handleConflictResolution(conflict.item.unit)}>
                  Use New Unit: {conflict.item.unit}
                </Button>
                <Button onClick={() => handleConflictResolution(conflict.existingUnit)}>
                  Keep Existing Unit: {conflict.existingUnit}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

      </div>
    </div>
  );
};

export default AdminPanelPage;
