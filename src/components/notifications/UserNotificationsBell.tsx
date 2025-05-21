"use client";

import { useEffect, useState } from 'react';
import { getFirestore, collection, query, where, onSnapshot, Timestamp, doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { auth } from '@/lib/firebaseClient'; 
import { Bell, CheckCircle2, ChevronDown, ChevronUp, X } from 'lucide-react';
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
  timestamp: Timestamp;
  isRead: boolean;
  adminNotes?: string; 
}

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
        const data = doc.data() as Omit<Notification, 'id'>;
        fetchedNotifications.push({ id: doc.id, ...data });
        if (!data.isRead) {
          count++;
        }
      });
      fetchedNotifications.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
      setNotifications(fetchedNotifications);
      setUnreadCount(count);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching notifications: ", error);
      toast({ title: "Error", description: "Could not fetch notifications.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleMarkAsRead = async (notificationId: string) => {
    if (!currentUser) {
      console.error("Cannot mark notification as read: User not authenticated");
      toast({ title: "Error", description: "You must be logged in to update notifications.", variant: "destructive" });
      return;
    }

    const db = getFirestore(auth.app);
    const notificationRef = doc(db, 'notifications', notificationId);
    
    try {
      // First get the notification to verify it belongs to this user
      const notificationSnap = await getDoc(notificationRef);
      if (!notificationSnap.exists()) {
        throw new Error("Notification not found");
      }
      
      const notificationData = notificationSnap.data();
      if (notificationData.userId !== currentUser.uid) {
        throw new Error("Permission denied: Not your notification");
      }
      
      // Now update the notification
      await updateDoc(notificationRef, { isRead: true });
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
    } catch (error) {
      console.error("Error marking all notifications as read: ", error);
      toast({ title: "Error", description: "Could not update all notification statuses.", variant: "destructive" });
    }
  };

  const fetchRequestDetails = async (notificationId: string, requestId: string) => {
    if (expandedNotification === notificationId) {
      // If already expanded, collapse it
      setExpandedNotification(null);
      setRequestDetails(null);
      return;
    }

    setIsLoadingDetails(true);
    setExpandedNotification(notificationId);

    try {
      const db = getFirestore(auth.app);
      
      // Check if requestId is valid
      if (!requestId || requestId.trim() === '') {
        // Create placeholder for invalid request ID instead of throwing error
        setRequestDetails({
          id: 'not-found',
          userId: '',
          userName: '',
          requestedItems: [],
          requestTimestamp: Timestamp.now(),
          status: 'pending', // Using valid status from the interface
          adminNotes: 'This request information is no longer available.'
        });
        return;
      }

      // Get request with explicit error handling
      const requestRef = doc(db, 'removalRequests', requestId);
      let requestSnap;
      
      try {
        requestSnap = await getDoc(requestRef);
      } catch (fetchError) {
        // Handle Firestore errors silently
        setRequestDetails({
          id: 'error',
          userId: '',
          userName: '',
          requestedItems: [],
          requestTimestamp: Timestamp.now(),
          status: 'rejected', // Using valid status from the interface
          adminNotes: 'There was an error retrieving this request.'
        });
        return;
      }

      if (!requestSnap.exists()) {
        // Create a placeholder for a request that doesn't exist anymore
        // instead of showing an error to the user
        setRequestDetails({
          id: 'deleted',
          userId: '',
          userName: '',
          requestedItems: [],
          requestTimestamp: Timestamp.now(),
          status: 'approved', // Using valid status from the interface
          adminNotes: 'This request has been processed and is no longer available.'
        });
        return;
      }

      // Get data with proper type cast
      const requestData = requestSnap.data();
      if (!requestData) {
        setRequestDetails({
          id: 'empty',
          userId: '',
          userName: '',
          requestedItems: [],
          requestTimestamp: Timestamp.now(),
          status: 'pending', // Using valid status from the interface
          adminNotes: 'This request has no data.'
        });
        return;
      }

      // Ensure data has expected fields
      const removalRequest: RemovalRequest = {
        id: requestSnap.id,
        userId: requestData.userId || '',
        userName: requestData.userName || '',
        requestedItems: requestData.requestedItems || [],
        requestTimestamp: requestData.requestTimestamp,
        status: requestData.status || 'pending',
        adminId: requestData.adminId,
        adminName: requestData.adminName,
        processedTimestamp: requestData.processedTimestamp,
        adminNotes: requestData.adminNotes
      };

      setRequestDetails(removalRequest);
      
      // Mark notification as read when expanding
      if (!notifications.find(n => n.id === notificationId)?.isRead) {
        handleMarkAsRead(notificationId);
      }
      
    } catch (error) {
      // Fall back to a friendly message rather than showing an error
      setRequestDetails({
        id: 'error',
        userId: '',
        userName: '',
        requestedItems: [],
        requestTimestamp: Timestamp.now(),
        status: 'rejected', // Using valid status from the interface
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
                      <p className={`text-sm ${!notif.isRead ? 'font-semibold' : 'text-muted-foreground'}`}>{notif.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(notif.timestamp.toDate()).toLocaleDateString()} {new Date(notif.timestamp.toDate()).toLocaleTimeString()}
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
                
                {expandedNotification === notif.id && (
                  <div className="px-3 pb-3 pt-0">
                    <Separator className="my-2" />
                    {isLoadingDetails ? (
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
                              {notif.adminNotes && (
                                <div className="mt-2">
                                  <p className="text-xs font-semibold">Admin Notes:</p>
                                  <p className="text-xs text-muted-foreground">{notif.adminNotes}</p>
                                </div>
                              )}
                            </div>
                            
                            <div>
                              <h5 className="text-xs font-semibold mb-1">Items {notif.type === 'request_approved' ? 'Removed' : 'Requested'}:</h5>
                              <ul className="space-y-1">
                                {requestDetails.requestedItems.map((item, index) => (
                                  <li key={index} className="text-xs">
                                    <span className="font-medium">{item.name}</span>: {item.quantityToRemove} {item.unit}
                                  </li>
                                ))}
                              </ul>
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
