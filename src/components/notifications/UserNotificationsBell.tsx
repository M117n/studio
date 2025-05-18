"use client";

import { useEffect, useState } from 'react';
import { getFirestore, collection, query, where, onSnapshot, Timestamp, doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { auth } from '@/lib/firebaseClient'; 
import { Bell, CheckCircle2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { toast } from '@/hooks/use-toast';

interface Notification {
  id: string;
  userId: string;
  type: 'request_approved' | 'request_rejected';
  message: string;
  requestId: string;
  timestamp: Timestamp;
  isRead: boolean;
  link?: string;
  adminNotes?: string; 
}

const UserNotificationsBell = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [isLoading, setIsLoading] = useState(true);

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
              <li key={notif.id} className={`p-3 hover:bg-accent ${!notif.isRead ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}>
                <div className="flex items-start space-x-3">
                  {!notif.isRead && (
                     <span className="flex-shrink-0 h-2 w-2 mt-1.5 bg-blue-500 rounded-full" aria-hidden="true"></span>
                  )}
                  <div className="flex-1">
                    <p className={`text-sm ${!notif.isRead ? 'font-semibold' : 'text-muted-foreground'}`}>{notif.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(notif.timestamp.toDate()).toLocaleDateString()} {new Date(notif.timestamp.toDate()).toLocaleTimeString()}
                    </p>
                    {notif.link && (
                      <Link href={notif.link} passHref>
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="p-0 h-auto text-xs mt-1"
                          onClick={() => !notif.isRead && handleMarkAsRead(notif.id)}
                        >
                          View Details
                        </Button>
                      </Link>
                    )}
                  </div>
                  {!notif.isRead && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMarkAsRead(notif.id)} title="Mark as read">
                      <CheckCircle2 className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default UserNotificationsBell;
