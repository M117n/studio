import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserNotificationsBell from '@/components/notifications/UserNotificationsBell';
import * as firebaseFirestore from 'firebase/firestore';
import * as firebaseAuth from 'firebase/auth';
import { toast } from '@/hooks/use-toast';

// Mock Firebase modules
jest.mock('firebase/firestore');
jest.mock('firebase/auth');
jest.mock('@/lib/firebaseClient', () => ({
  auth: {
    currentUser: { uid: 'test-user-id' },
    onAuthStateChanged: jest.fn((callback) => {
      callback({ uid: 'test-user-id' });
      return jest.fn(); // Return unsubscribe function
    }),
    app: {}
  }
}));
jest.mock('@/hooks/use-toast', () => ({
  toast: jest.fn()
}));

// Mock Notifications data
const mockNotifications = [
  {
    id: 'notif-1',
    userId: 'test-user-id',
    type: 'request_approved',
    message: 'Your removal request has been approved.',
    requestId: 'req-123',
    timestamp: { toDate: () => new Date(), toMillis: () => Date.now() },
    isRead: false,
    link: '/requests/req-123'
  },
  {
    id: 'notif-2',
    userId: 'test-user-id',
    type: 'request_rejected',
    message: 'Your removal request has been rejected.',
    requestId: 'req-456',
    timestamp: { toDate: () => new Date(Date.now() - 86400000), toMillis: () => Date.now() - 86400000 },
    isRead: true,
    adminNotes: 'Rejected due to inventory constraints',
    link: '/requests/req-456'
  }
];

// Create mock implementations
const mockOnSnapshot = jest.fn((query, callback) => {
  callback({
    forEach: (cb) => {
      mockNotifications.forEach((notif) => {
        cb({
          id: notif.id,
          data: () => ({ ...notif })
        });
      });
    }
  });
  return jest.fn(); // Return unsubscribe function
});

const mockCollection = jest.fn(() => 'notifications-collection');
const mockQuery = jest.fn(() => 'notifications-query');
const mockWhere = jest.fn(() => 'where-clause');
const mockDoc = jest.fn(() => 'notification-doc-ref');
const mockGetDoc = jest.fn().mockImplementation(() => ({
  exists: () => true,
  data: () => mockNotifications[0]
}));
const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);

describe('UserNotificationsBell Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup the mocks
    (firebaseFirestore.getFirestore as jest.Mock).mockReturnValue({});
    (firebaseFirestore.collection as jest.Mock).mockImplementation(mockCollection);
    (firebaseFirestore.query as jest.Mock).mockImplementation(mockQuery);
    (firebaseFirestore.where as jest.Mock).mockImplementation(mockWhere);
    (firebaseFirestore.onSnapshot as jest.Mock).mockImplementation(mockOnSnapshot);
    (firebaseFirestore.doc as jest.Mock).mockImplementation(mockDoc);
    (firebaseFirestore.getDoc as jest.Mock).mockImplementation(mockGetDoc);
    (firebaseFirestore.updateDoc as jest.Mock).mockImplementation(mockUpdateDoc);
  });

  test('renders notification bell with correct unread count', async () => {
    render(<UserNotificationsBell />);
    
    // Only one unread notification in our mock data
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  test('opens notification popover when clicked', async () => {
    render(<UserNotificationsBell />);
    
    // Click the notification bell
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(bellButton);
    
    // Check if popover content is displayed
    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByText('Your removal request has been approved.')).toBeInTheDocument();
      expect(screen.getByText('Your removal request has been rejected.')).toBeInTheDocument();
    });
  });

  test('marks notification as read when mark as read button is clicked', async () => {
    render(<UserNotificationsBell />);
    
    // Click the notification bell to open popover
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(bellButton);
    
    // Click mark as read button
    await waitFor(() => {
      const markAsReadButton = screen.getByTitle('Mark as read');
      fireEvent.click(markAsReadButton);
    });
    
    // Check if updateDoc was called with correct arguments
    expect(firebaseFirestore.doc).toHaveBeenCalledWith({}, 'notifications', 'notif-1');
    expect(firebaseFirestore.updateDoc).toHaveBeenCalledWith('notification-doc-ref', { isRead: true });
  });

  test('marks all notifications as read when "Mark all as read" is clicked', async () => {
    render(<UserNotificationsBell />);
    
    // Click the notification bell to open popover
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(bellButton);
    
    // Click mark all as read button
    await waitFor(() => {
      const markAllButton = screen.getByText('Mark all as read');
      fireEvent.click(markAllButton);
    });
    
    // Should create a writeBatch and commit it
    expect(firebaseFirestore.writeBatch).toHaveBeenCalled();
  });

  test('handles error when marking notification as read fails', async () => {
    // Mock updateDoc to throw an error
    (firebaseFirestore.updateDoc as jest.Mock).mockRejectedValueOnce(new Error('Database error'));
    
    render(<UserNotificationsBell />);
    
    // Click the notification bell to open popover
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(bellButton);
    
    // Click mark as read button
    await waitFor(() => {
      const markAsReadButton = screen.getByTitle('Mark as read');
      fireEvent.click(markAsReadButton);
    });
    
    // Check if toast was called with error message
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: 'Error', 
        description: 'Database error', 
        variant: 'destructive'
      });
    });
  });

  test('View details link marks notification as read when clicked', async () => {
    render(<UserNotificationsBell />);
    
    // Click the notification bell to open popover
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(bellButton);
    
    // Click view details link
    await waitFor(() => {
      const viewDetailsButton = screen.getByText('View Details');
      fireEvent.click(viewDetailsButton);
    });
    
    // Check if updateDoc was called correctly
    expect(firebaseFirestore.doc).toHaveBeenCalledWith({}, 'notifications', 'notif-1');
    expect(firebaseFirestore.updateDoc).toHaveBeenCalledWith('notification-doc-ref', { isRead: true });
  });

  test('handles no authenticated user', async () => {
    // Override auth mock for this test
    const authModuleMock = require('@/lib/firebaseClient');
    authModuleMock.auth.currentUser = null;
    authModuleMock.auth.onAuthStateChanged.mockImplementationOnce((callback) => {
      callback(null);
      return jest.fn();
    });
    
    render(<UserNotificationsBell />);
    
    // Should not render anything when user is not logged in
    expect(screen.queryByRole('button', { name: /notifications/i })).not.toBeInTheDocument();
  });
});
