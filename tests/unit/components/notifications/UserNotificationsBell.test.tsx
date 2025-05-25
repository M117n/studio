import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserNotificationsBell from '@/components/notifications/UserNotificationsBell'; // Adjust path if needed
import * as firebaseFirestore from 'firebase/firestore';
import { type User as FirebaseAuthUser } from 'firebase/auth'; // ADDED for typing
// No need to import firebase/auth directly if fully mocked via firebaseClient
// import * as firebaseAuth from 'firebase/auth';
import { toast } from '@/hooks/use-toast';

// Mock Firebase modules
jest.mock('firebase/firestore');
// jest.mock('firebase/auth'); // Already implicitly mocked by firebaseClient mock

jest.mock('@/lib/firebaseClient', () => ({
  auth: {
    currentUser: { uid: 'test-user-id', displayName: 'Test User' } as FirebaseAuthUser, // Added displayName for consistency
    onAuthStateChanged: jest.fn((callback: (user: FirebaseAuthUser | null) => void) => {
      // Simulate initial auth state
      const user = { uid: 'test-user-id', displayName: 'Test User' } as FirebaseAuthUser;
      callback(user);
      // Return an unsubscribe function
      return jest.fn();
    }),
    app: {} // Mock app object
  }
}));

jest.mock('@/hooks/use-toast', () => ({
  toast: jest.fn()
}));

// --- Mock Data ---
const mockTimestamp = () => ({
  toDate: () => new Date(),
  toMillis: () => Date.now(),
} as firebaseFirestore.Timestamp);

const mockOldTimestamp = () => ({
  toDate: () => new Date(Date.now() - 86400000), // 1 day ago
  toMillis: () => Date.now() - 86400000,
} as firebaseFirestore.Timestamp);


const mockNotificationsBase = [
  {
    id: 'notif-1',
    userId: 'test-user-id',
    type: 'request_approved' as 'request_approved' | 'request_rejected',
    message: 'Your item addition request (ID: req-123-id) for steak has been approved. Inventory updated.',
    requestId: 'req-123',
    timestamp: mockTimestamp(),
    isRead: false,
  },
  {
    id: 'notif-2',
    userId: 'test-user-id',
    type: 'request_rejected' as 'request_approved' | 'request_rejected',
    message: 'Your item removal request (ID: req-456-id) for bread has been rejected.',
    requestId: 'req-456',
    timestamp: mockOldTimestamp(),
    isRead: true,
    adminNotes: 'Rejected due to inventory constraints',
  },
  {
    id: 'notif-3',
    userId: 'test-user-id',
    type: 'request_approved' as 'request_approved' | 'request_rejected',
    message: 'Your request (ID: req-empty-id) has been approved. Inventory updated.',
    requestId: 'req-empty-items',
    timestamp: { toDate: () => new Date(Date.now() - 172800000), toMillis: () => Date.now() - 172800000 } as firebaseFirestore.Timestamp, // 2 days ago
    isRead: false,
  }
];

const mockRemovalRequestData: Record<string, any> = {
  'req-123': {
    id: 'req-123',
    userId: 'test-user-id',
    userName: 'Test User',
    requestedItems: [
      { itemId: 'item-A', name: 'Flank Steak', quantityToRemove: 2, unit: 'kg' }
    ],
    requestTimestamp: mockTimestamp(),
    status: 'approved',
  },
  'req-456': {
    id: 'req-456',
    userId: 'test-user-id',
    userName: 'Test User',
    requestedItems: [
      { itemId: 'item-B', name: 'Bread Loaf', quantityToRemove: 1, unit: 'piece' }
    ],
    requestTimestamp: mockOldTimestamp(),
    status: 'rejected',
    adminNotes: 'Rejected due to inventory constraints',
  },
  'req-empty-items': {
    id: 'req-empty-items',
    userId: 'test-user-id',
    userName: 'Test User',
    requestedItems: [], // No items
    requestTimestamp: mockTimestamp(),
    status: 'approved',
  }
};

// --- Mock Firestore Implementations ---
let currentMockNotifications = [...mockNotificationsBase]; // Use a copy

const mockOnSnapshot = jest.fn(
  (
    query: firebaseFirestore.Query, // ADDED type
    callback: (snapshot: firebaseFirestore.QuerySnapshot) => void // ADDED type
  ) => {
    const snapshotData = {
      docs: currentMockNotifications.map(notif => {
        const docData = { ...notif };
        return {
          id: notif.id,
          data: () => docData as firebaseFirestore.DocumentData,
          exists: () => true as const,
          get: (fieldPath: string | firebaseFirestore.FieldPath) => {
            if (typeof fieldPath === 'string') {
              return (docData as any)[fieldPath];
            }
            // Basic handling for FieldPath, actual implementation might be more complex
            // For tests, usually string paths or data() are sufficient.
            console.warn('Mock QueryDocumentSnapshot get() with FieldPath not fully implemented');
            return undefined;
          },
          ref: { id: notif.id, path: `notifications/${notif.id}` } as unknown as firebaseFirestore.DocumentReference,
          metadata: { hasPendingWrites: false, fromCache: false } as firebaseFirestore.SnapshotMetadata,
        } as firebaseFirestore.QueryDocumentSnapshot;
      }),
      forEach: (cb: (docSnapshot: firebaseFirestore.QueryDocumentSnapshot) => void) => {
        snapshotData.docs.forEach(doc => cb(doc));
      },
      empty: currentMockNotifications.length === 0,
      size: currentMockNotifications.length,
      query: query, // ADDED for QuerySnapshot conformity
      docChanges: (): firebaseFirestore.DocumentChange[] => { // ADDED for QuerySnapshot conformity
        // Return an empty array or a more sophisticated mock if docChanges are used
        return [];
      }
    };
    callback(snapshotData as firebaseFirestore.QuerySnapshot);
    return jest.fn(); // Return unsubscribe function
  }
);


const mockDoc = jest.fn((db, collectionPath, docId) => ({
  _collectionPath: collectionPath,
  _docId: docId,
  // This is a simplified mock, real DocumentReference has more properties/methods
  // For the purpose of being an argument to getDoc/updateDoc mocks, this is often sufficient
  id: docId,
  path: `${collectionPath}/${docId}`,
} as unknown as firebaseFirestore.DocumentReference));

const mockGetDoc = jest.fn().mockImplementation(async (docRef: { _collectionPath: string, _docId: string, id: string, path: string }) => {
  const commonMockProps = (id: string, collectionPath: string) => ({
    id: id,
    ref: { id, path: `${collectionPath}/${id}` } as unknown as firebaseFirestore.DocumentReference,
    metadata: { hasPendingWrites: false, fromCache: false } as firebaseFirestore.SnapshotMetadata,
    get: (fieldPath: string | firebaseFirestore.FieldPath) => {
        const data = (collectionPath === 'notifications'
            ? currentMockNotifications.find(n => n.id === id)
            : mockRemovalRequestData[id]) || {};
        if (typeof fieldPath === 'string') return (data as any)[fieldPath];
        console.warn('Mock DocumentSnapshot get() with FieldPath not fully implemented');
        return undefined;
    }
  });

  if (docRef._collectionPath === 'notifications') {
    const notification = currentMockNotifications.find(n => n.id === docRef._docId);
    if (notification) {
      return Promise.resolve({
        exists: () => true,
        data: () => ({ ...notification }) as firebaseFirestore.DocumentData,
        ...commonMockProps(notification.id, docRef._collectionPath)
      } as firebaseFirestore.DocumentSnapshot);
    }
  }
  if (docRef._collectionPath === 'removalRequests') {
    const requestData = mockRemovalRequestData[docRef._docId];
    if (requestData) {
      return Promise.resolve({
        exists: () => true,
        data: () => ({ ...requestData }) as firebaseFirestore.DocumentData,
        ...commonMockProps(requestData.id, docRef._collectionPath)
      } as firebaseFirestore.DocumentSnapshot);
    }
  }
  // Default not found
  return Promise.resolve({
    exists: () => false,
    data: () => undefined,
    ...commonMockProps(docRef._docId, docRef._collectionPath)
  } as firebaseFirestore.DocumentSnapshot);
});

const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockWriteBatch = jest.fn(() => ({
  update: mockBatchUpdate,
  commit: mockBatchCommit,
}));

describe('UserNotificationsBell Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentMockNotifications = JSON.parse(JSON.stringify(mockNotificationsBase)); // Reset to a deep copy

    // Setup Firestore mocks
    (firebaseFirestore.getFirestore as jest.Mock).mockReturnValue({}); // Mock DB object
    (firebaseFirestore.collection as jest.Mock).mockReturnValue({ type: 'collection' } as any);
    (firebaseFirestore.query as jest.Mock).mockReturnValue({ type: 'query' } as any);
    (firebaseFirestore.where as jest.Mock).mockReturnValue({ type: 'where' } as any);
    (firebaseFirestore.onSnapshot as jest.Mock).mockImplementation(mockOnSnapshot);
    (firebaseFirestore.doc as jest.Mock).mockImplementation(mockDoc);
    (firebaseFirestore.getDoc as jest.Mock).mockImplementation(mockGetDoc);
    (firebaseFirestore.updateDoc as jest.Mock).mockImplementation(mockUpdateDoc);
    (firebaseFirestore.writeBatch as jest.Mock).mockImplementation(mockWriteBatch);

    // Reset auth mock if needed, though jest.mock should handle module-level reset.
    // Forcing currentUser for most tests.
    const authModuleMock = require('@/lib/firebaseClient');
    authModuleMock.auth.currentUser = { uid: 'test-user-id', displayName: 'Test User' } as FirebaseAuthUser;
    authModuleMock.auth.onAuthStateChanged.mockImplementation(
      (callback: (user: FirebaseAuthUser | null) => void) => { // ADDED type for callback
      callback({ uid: 'test-user-id', displayName: 'Test User' } as FirebaseAuthUser); // ADDED cast for user
      return jest.fn();
    });

  });

  test('renders notification bell with correct unread count', async () => {
    render(<UserNotificationsBell />);
    // mockNotificationsBase has 2 unread notifications (notif-1, notif-3)
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  test('opens notification popover and displays notifications with initial friendly messages', async () => {
    render(<UserNotificationsBell />);
    const bellButton = screen.getByRole('button', { name: /notifications/i }); // Using regex for flexibility
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument();
      // Check for initially cleaned messages
      expect(screen.getByText('Your item addition request for steak has been approved.')).toBeInTheDocument();
      expect(screen.getByText('Your item removal request for bread has been rejected.')).toBeInTheDocument();
      expect(screen.getByText('Your request has been approved.')).toBeInTheDocument();
    });
  });

  test('marks a specific notification as read when its "mark as read" button is clicked', async () => {
    render(<UserNotificationsBell />);
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    // There should be two "Mark as read" buttons for notif-1 and notif-3
    const markAsReadButtons = await screen.findAllByTitle('Mark as read');
    expect(markAsReadButtons.length).toBeGreaterThanOrEqual(1); // At least one unread
    
    fireEvent.click(markAsReadButtons[0]); // Click the first one (should be for notif-1)

    await waitFor(() => {
      expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'notifications', 'notif-1');
      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.objectContaining({ _docId: 'notif-1' }), { isRead: true });
    });
  });

  test('marks all notifications as read when "Mark all as read" is clicked', async () => {
    render(<UserNotificationsBell />);
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    const markAllButton = await screen.findByText('Mark all as read');
    fireEvent.click(markAllButton);

    await waitFor(() => {
      expect(mockWriteBatch).toHaveBeenCalled();
      // Two unread notifications: notif-1 and notif-3
      expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
      expect(mockBatchUpdate).toHaveBeenCalledWith(expect.objectContaining({ _docId: 'notif-1' }), { isRead: true });
      expect(mockBatchUpdate).toHaveBeenCalledWith(expect.objectContaining({ _docId: 'notif-3' }), { isRead: true });
      expect(mockBatchCommit).toHaveBeenCalled();
    });
  });

  test('updates notification message with full details after clicking "View Details"', async () => {
    render(<UserNotificationsBell />);
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    // Find "View Details" for the first notification (notif-1)
    // The text might be inside a button, so query more broadly initially.
    const viewDetailsButtons = await screen.findAllByText(/View Details/i);
    fireEvent.click(viewDetailsButtons[0]); // Click for notif-1

    await waitFor(() => {
      // Check if getDoc for removalRequests was called
      expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'removalRequests', 'req-123');
      expect(mockGetDoc).toHaveBeenCalledWith(expect.objectContaining({ _collectionPath: 'removalRequests', _docId: 'req-123' }));
      
      // Check for the updated, fully detailed message for notif-1
      // Original: 'Your item addition request (ID: req-123-id) for steak has been approved. Inventory updated.'
      // Expected: 'Your item addition request for 2 kg of Flank Steak has been approved.'
      expect(screen.getByText('Your item addition request for 2 kg of Flank Steak has been approved.')).toBeInTheDocument();
    });
  });

  test('View Details also marks the notification as read if it was unread', async () => {
    render(<UserNotificationsBell />);
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    
    const viewDetailsButtons = await screen.findAllByText(/View Details/i);
    fireEvent.click(viewDetailsButtons[0]); // For notif-1 which is unread

    await waitFor(() => {
        // Check that getDoc for notification 'notif-1' was called by handleMarkAsRead (triggered by fetchRequestDetails)
        // This is part of the handleMarkAsRead internal logic
        expect(mockGetDoc).toHaveBeenCalledWith(expect.objectContaining({ _collectionPath: 'notifications', _docId: 'notif-1' }));
        // And updateDoc was called to mark it as read
        expect(mockUpdateDoc).toHaveBeenCalledWith(expect.objectContaining({ _docId: 'notif-1' }), { isRead: true });
    });
  });

  test('displays basic cleaned message if "View Details" is for a request with no items', async () => {
    render(<UserNotificationsBell />);
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    // Find "View Details" for notif-3 (requestId: 'req-empty-items')
    const viewDetailsButtons = await screen.findAllByText(/View Details/i);
    // Assuming notif-3 is the third "View Details" button if ordered by mockNotificationsBase
    // A more robust way would be to find the button within the context of notif-3's message
    const notif3MessageInitial = 'Your request has been approved.'; // After initial cleaning
    const notif3Element = screen.getByText(notif3MessageInitial).closest('li');
    if (!notif3Element) throw new Error("Notification 3 element not found");
    const viewDetailsButtonForNotif3 = Array.from(notif3Element.querySelectorAll('button')).find(btn => btn.textContent?.includes('View Details'));
    if (!viewDetailsButtonForNotif3) throw new Error("View Details for Notif3 not found");

    fireEvent.click(viewDetailsButtonForNotif3);

    await waitFor(() => {
      expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'removalRequests', 'req-empty-items');
      expect(mockGetDoc).toHaveBeenCalledWith(expect.objectContaining({ _collectionPath: 'removalRequests', _docId: 'req-empty-items' }));
      
      // The message should remain the basic cleaned one because no item details to enhance it
      // generateFriendlyMessage(original, type, []) will result in basic cleaned.
      expect(screen.getByText(notif3MessageInitial)).toBeInTheDocument(); 
      // And should see "No items listed for this request." in the details section
      expect(screen.getByText("No items listed for this request.")).toBeInTheDocument();
    });
  });

  test('handles error when marking notification as read fails', async () => {
    (mockUpdateDoc as jest.Mock).mockRejectedValueOnce(new Error('Database error'));
    render(<UserNotificationsBell />);
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    
    const markAsReadButtons = await screen.findAllByTitle('Mark as read');
    fireEvent.click(markAsReadButtons[0]);
    
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: 'Error', 
        description: 'Database error', 
        variant: 'destructive'
      });
    });
  });

  test('handles no authenticated user gracefully', async () => {
    // Override auth mock for this specific test
    const authModuleMock = require('@/lib/firebaseClient');
    authModuleMock.auth.currentUser = null;
    // Ensure onAuthStateChanged callback is invoked with null
    authModuleMock.auth.onAuthStateChanged.mockImplementationOnce((callback: (user: any) => void) => {
      callback(null);
      return jest.fn(); // unsubscribe
    });
    
    render(<UserNotificationsBell />);
    
    expect(screen.queryByRole('button', { name: /notifications/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
  });

  test('displays "No notifications yet." when there are no notifications', async () => {
    currentMockNotifications = []; // Set to empty
    render(<UserNotificationsBell />);
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    await waitFor(() => {
      expect(screen.getByText('No notifications yet.')).toBeInTheDocument();
    });
  });

  test('displays loading state initially for notifications list', () => {
    // Prevent onSnapshot from resolving immediately to catch loading state
    (firebaseFirestore.onSnapshot as jest.Mock).mockImplementationOnce(() => jest.fn()); // No callback, stays loading
    render(<UserNotificationsBell />);
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByText('Loading notifications...')).toBeInTheDocument();
  });

  test('displays loading state for request details', async () => {
    // Make getDoc for removalRequests pend
    (firebaseFirestore.getDoc as jest.Mock).mockImplementationOnce(async (docRef) => {
      if (docRef._collectionPath === 'removalRequests') {
        return new Promise(() => {}); // Never resolves
      }
      // Handle other getDoc calls normally for this test if any
      const notification = currentMockNotifications.find(n => n.id === docRef._docId);
      if (notification) return Promise.resolve({ exists: () => true, data: () => notification });
      return Promise.resolve({ exists: () => false });
    });

    render(<UserNotificationsBell />);
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    const viewDetailsButtons = await screen.findAllByText(/View Details/i);
    fireEvent.click(viewDetailsButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Loading details...')).toBeInTheDocument();
    });
  });
});