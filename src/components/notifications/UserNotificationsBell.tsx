"use client";

import { useEffect, useState } from 'react';
import { getFirestore, collection, query, where, onSnapshot, Timestamp, doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { auth } from '@/lib/firebaseClient';
import { Bell, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'; // Removed X as it wasn't used in the provided snippet for this part
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

interface RequestedItemDetail {
  itemId: string;
  name: string;
  quantityToRemove: number;
  unit: string;
  category?: string | null;
  imageUrl?: string | null;
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

interface Notification {
  id: string;
  userId: string;
  type: 'request_approved' | 'request_rejected';
  message: string;
  requestId: string;
  timestamp: Timestamp | null;
  isRead: boolean;
  adminNotes?: string;
  approvedItems?: { name: string; quantity: number; unit: string }[];
  _friendlyMessageCache?: string; // Cache for the enhanced message
}

// Helper function to generate more user-friendly notification messages
const generateFriendlyMessage = (
  originalMessage: string,
  notificationType: 'request_approved' | 'request_rejected',
  items?: RequestedItemDetail[] // Optional: for full version with quantity
): string => {
  
  // Basic cleanup: remove ID and trailing "Inventory updated."
  let friendlyMsg = originalMessage.replace(/\s\(ID: [^\)]+\)/, ''); // Removes " (ID: ...)"
  friendlyMsg = friendlyMsg.replace(/\.?\s*Inventory updated\.*$/i, ''); // Removes ". Inventory updated." or " Inventory updated" etc.

  // Ensure message ends with a period if it doesn't have one after stripping "Inventory updated"
  friendlyMsg = friendlyMsg.trim();
  if (friendlyMsg.length > 0 && !['.', '!', '?'].includes(friendlyMsg[friendlyMsg.length - 1])) {
      friendlyMsg += '.';
  }

  if (items && items.length > 0) {
    const firstItem = items[0];
    const itemName = firstItem.name;
    const quantity = firstItem.quantityToRemove; // Assuming this is the magnitude
    const unit = firstItem.unit;
    const status = notificationType === 'request_approved' ? 'approved' : 'rejected';

    let actionPrefix = "Your request"; // Generic fallback
    // Try to be more specific based on original message patterns
    if (originalMessage.toLowerCase().startsWith("your item addition request")) {
        actionPrefix = "Your item addition request";
    } else if (originalMessage.toLowerCase().startsWith("your item removal request")) {
        actionPrefix = "Your item removal request";
    }
    // Add more specific parsers for other phrasings if needed.

    if (items.length > 1) {
      friendlyMsg = `${actionPrefix} for ${quantity} ${unit} of ${itemName} and other items has been ${status}.`;
    } else {
      friendlyMsg = `${actionPrefix} for ${quantity} ${unit} of ${itemName} has been ${status}.`;
    }
  }
  return friendlyMsg;
};


const UserNotificationsBell = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedNotification, setExpandedNotification] = useState<string | null>(null);
  const [requestDetails, setRequestDetails] = useState<RemovalRequest | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const db = getFirestore(auth.app);
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      // orderBy('timestamp', 'desc') // Firestore requires an index for this
    );

    const unsubscribe = onSnapshot(notificationsQuery, (querySnapshot) => {
      const fetchedNotifications: Notification[] = [];
      let count = 0;
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<Notification, 'id' | '_friendlyMessageCache'>; // Exclude cache from DB cast
        // Retain existing cache if any, or set to undefined
        const existingNotification = notifications.find(n => n.id === doc.id);
        fetchedNotifications.push({ 
            id: doc.id, 
            ...data, 
            _friendlyMessageCache: existingNotification?._friendlyMessageCache 
        });
        if (!data.isRead) {
          count++;
        }
      });
      fetchedNotifications.sort((a, b) => {
        const bTime = b.timestamp && typeof b.timestamp.toMillis === 'function' ? b.timestamp.toMillis() : 0;
        const aTime = a.timestamp && typeof a.timestamp.toMillis === 'function' ? a.timestamp.toMillis() : 0;
        return bTime - aTime;
      });
      setNotifications(fetchedNotifications);
      setUnreadCount(count);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching notifications: ", error);
      toast({ title: "Error", description: "Could not fetch notifications.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]); // Removed 'notifications' from dependency array to avoid potential re-runs if only _friendlyMessageCache changes

  const handleMarkAsRead = async (notificationId: string) => {
    if (!currentUser) {
      console.error("Cannot mark notification as read: User not authenticated");
      toast({ title: "Error", description: "You must be logged in to update notifications.", variant: "destructive" });
      return;
    }

    const db = getFirestore(auth.app);
    const notificationRef = doc(db, 'notifications', notificationId);
    
    try {
      const notificationSnap = await getDoc(notificationRef);
      if (!notificationSnap.exists()) {
        throw new Error("Notification not found");
      }
      
      const notificationData = notificationSnap.data();
      if (notificationData.userId !== currentUser.uid) {
        throw new Error("Permission denied: Not your notification");
      }
      
      await updateDoc(notificationRef, { isRead: true });
      // No need to manually update local state for isRead here, 
      // onSnapshot should reflect this change from Firestore.
    } catch (error: any) {
      console.error("Error marking notification as read: ", error);
      toast({ 
        title: "Error", 
        description: error.message || "Could not update notification status.", 
        variant: "destructive" 
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!currentUser || notifications.filter(n => !n.isRead).length === 0) return;
    const db = getFirestore(auth.app);
    const unreadNotifications = notifications.filter(n => !n.isRead);
    const batch = writeBatch(db);
    unreadNotifications.forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { isRead: true });
    });
    try {
      await batch.commit();
      // onSnapshot should update the UI.
    } catch (error) {
      console.error("Error marking all notifications as read: ", error);
      toast({ title: "Error", description: "Could not update all notification statuses.", variant: "destructive" });
    }
  };

  const fetchRequestDetails = async (notificationId: string, requestId: string) => {
    if (expandedNotification === notificationId) {
      setExpandedNotification(null);
      setRequestDetails(null);
      return;
    }

    setIsLoadingDetails(true);
    setExpandedNotification(notificationId);
    // setRequestDetails(null); // Clear previous details while loading new ones

    try {
      const db = getFirestore(auth.app);
      
      if (!requestId || requestId.trim() === '') {
        setRequestDetails({
          id: 'not-found', userId: '', userName: '', requestedItems: [],
          requestTimestamp: Timestamp.now(), status: 'pending',
          adminNotes: 'This request information is no longer available.'
        });
        return;
      }

      const requestRef = doc(db, 'removalRequests', requestId);
      let requestSnap;
      
      try {
        requestSnap = await getDoc(requestRef);
      } catch (fetchError) {
        setRequestDetails({
          id: 'error', userId: '', userName: '', requestedItems: [],
          requestTimestamp: Timestamp.now(), status: 'rejected',
          adminNotes: 'There was an error retrieving this request.'
        });
        return;
      }

      if (!requestSnap.exists()) {
        setRequestDetails({
          id: 'deleted', userId: '', userName: '', requestedItems: [],
          requestTimestamp: Timestamp.now(), status: 'approved',
          adminNotes: 'This request has been processed and is no longer available.'
        });
        return;
      }

      const requestData = requestSnap.data();
      if (!requestData) {
        setRequestDetails({
          id: 'empty', userId: '', userName: '', requestedItems: [],
          requestTimestamp: Timestamp.now(), status: 'pending',
          adminNotes: 'This request has no data.'
        });
        return;
      }

      const removalRequest: RemovalRequest = {
        id: requestSnap.id,
        userId: requestData.userId || '',
        userName: requestData.userName || '',
        requestedItems: requestData.requestedItems || [],
        requestTimestamp: requestData.requestTimestamp || Timestamp.now(), // Added fallback for timestamp
        status: requestData.status || 'pending',
        adminId: requestData.adminId,
        adminName: requestData.adminName,
        processedTimestamp: requestData.processedTimestamp,
        adminNotes: requestData.adminNotes
      };
      setRequestDetails(removalRequest);
      
      const currentNotif = notifications.find(n => n.id === notificationId);
      if (currentNotif && !currentNotif.isRead) {
        handleMarkAsRead(notificationId);
      }
      
      if (currentNotif) {
        setNotifications(prevNotifications =>
          prevNotifications.map(n => {
            if (n.id === notificationId) {
              return { 
                ...n, 
                _friendlyMessageCache: generateFriendlyMessage(n.message, n.type, removalRequest.requestedItems) 
              };
            }
            return n;
          })
        );
      }
      
    } catch (error) {
      console.error("Error fetching request details:", error);
      setRequestDetails({
        id: 'error-generic', userId: '', userName: '', requestedItems: [],
        requestTimestamp: Timestamp.now(), status: 'rejected',
        adminNotes: 'An error occurred while retrieving this request.'
      });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  if (!currentUser) {
    return null; 
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-96 overflow-y-auto p-0">
        <div className="p-4 border-b flex justify-between items-center">
          <h4 className="font-medium">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="link" size="sm" onClick={handleMarkAllAsRead} className="text-xs">
              Mark all as read
            </Button>
          )}
        </div>
        {isLoading ? (
          <p className="p-4 text-center text-sm text-muted-foreground">Loading notifications...</p>
        ) : notifications.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          <ul className="divide-y">
            {notifications.map(notif => (
              <li key={notif.id}>
                <div className={`p-3 hover:bg-accent ${!notif.isRead ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}>
                  <div className="flex items-start space-x-3">
                    {!notif.isRead && (
                      <span className="flex-shrink-0 h-2 w-2 mt-1.5 bg-blue-500 rounded-full" aria-hidden="true"></span>
                    )}
                    <div className="flex-1">
                      {/* UPDATED MESSAGE DISPLAY */}
                      <p className={`text-sm ${!notif.isRead ? 'font-semibold' : 'text-muted-foreground'}`}>
                        {notif._friendlyMessageCache || generateFriendlyMessage(notif.message, notif.type, undefined)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(() => {
                          const date = notif.timestamp && typeof notif.timestamp.toDate === 'function'
                            ? notif.timestamp.toDate()
                            : null;
                          return date ? `${date.toLocaleDateString()} ${date.toLocaleTimeString()}` : 'Unknown date';
                        })()}
                      </p>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="p-0 h-auto text-xs mt-1 flex items-center"
                        onClick={() => fetchRequestDetails(notif.id, notif.requestId)}
                      >
                        {expandedNotification === notif.id ? (
                          <>
                            Hide Details
                            <ChevronUp className="ml-1 h-3 w-3" />
                          </>
                        ) : (
                          <>
                            View Details
                            <ChevronDown className="ml-1 h-3 w-3" />
                          </>
                        )}
                      </Button>
                    </div>
                    {!notif.isRead && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMarkAsRead(notif.id)} title="Mark as read">
                        <CheckCircle2 className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Using the bug fix solution for item display and admin notes from previous interaction */}
                {expandedNotification === notif.id && (
                  <div className="px-3 pb-3 pt-0">
                    <Separator className="my-2" />
                    {notif.type === 'request_approved' && notif.approvedItems && notif.approvedItems.length > 0 ? (
                      <Card className="bg-slate-50 dark:bg-slate-900 border-none shadow-none">
                        <CardContent className="p-3">
                          <h5 className="text-xs font-semibold mb-1">Approved Items:</h5>
                          <ul className="space-y-1">
                            {notif.approvedItems.map((item, index) => (
                              <li key={index} className="text-xs">
                                <span className="font-medium">{item.name}</span>: {item.quantity} {item.unit}
                              </li>
                            ))}
                          </ul>
                          {notif.adminNotes && (
                             <div className="mt-2">
                               <p className="text-xs font-semibold">Admin Notes:</p>
                               <p className="text-xs text-muted-foreground whitespace-pre-wrap">{notif.adminNotes}</p>
                             </div>
                          )}
                        </CardContent>
                      </Card>
                    ) : isLoadingDetails ? (
                      <div className="py-2 text-center">
                        <p className="text-xs text-muted-foreground">Loading details...</p>
                      </div>
                    ) : requestDetails ? (
                      <Card className="bg-slate-50 dark:bg-slate-900 border-none shadow-none">
                        <CardContent className="p-3">
                          <div className="space-y-3">
                            <div>
                              <h5 className="text-xs font-semibold mb-1">Request Details</h5>
                              <p className="text-xs text-muted-foreground">
                                Status: <span className="font-medium capitalize">{requestDetails.status}</span>
                              </p>
                              
                              {(notif.adminNotes || requestDetails.adminNotes) && (
                                <div className="mt-2">
                                  <p className="text-xs font-semibold">Admin Notes:</p>
                                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{requestDetails.adminNotes || notif.adminNotes}</p>
                                </div>
                              )}
                            </div>
                            
                            <div>
                              <h5 className="text-xs font-semibold mb-1">Items in Request:</h5>
                              {requestDetails.requestedItems && requestDetails.requestedItems.length > 0 ? (
                                <ul className="space-y-1">
                                  {requestDetails.requestedItems.map((item, index) => (
                                    <li key={index} className="text-xs">
                                      <span className="font-medium">{item.name}</span>: {item.quantityToRemove} {item.unit}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-xs text-muted-foreground">No items listed for this request.</p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <p className="text-xs text-destructive py-2">Could not load request details.</p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default UserNotificationsBell;