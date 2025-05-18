import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import UserNotificationsBell from '@/components/notifications/UserNotificationsBell';
import AdminPanelPage from '@/app/admin/requests/page';
import RequestDetailsPage from '@/app/requests/[id]/page';
import * as firebaseFirestore from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

// Mock necessary modules
jest.mock('firebase/firestore');
jest.mock('@/hooks/use-toast', () => ({
  toast: jest.fn()
}));
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
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    back: jest.fn(),
  }))
}));

// Test data
const testUserId = 'test-user-id';
const testAdminId = 'admin-user-id';
const testRequestId = 'request-123';

// Mock request data
const mockRequest = {
  id: testRequestId,
  userId: testUserId,
  userName: 'Test User',
  requestedItems: [
    {
      itemId: 'item-1',
      name: 'Test Item 1',
      quantityToRemove: 5,
      unit: 'units',
      category: 'Test Category'
    }
  ],
  requestTimestamp: {
    toDate: () => new Date('2025-05-15T12:00:00Z'),
    toMillis: () => Date.now() - 86400000
  },
  status: 'pending'
};

// Mock inventory item
const mockInventoryItem = {
  id: 'item-1',
  name: 'Test Item 1',
  quantity: 10,
  unit: 'units',
  category: 'Test Category'
};

// Mock notification
const mockNotification = {
  id: 'notification-1',
  userId: testUserId,
  type: 'request_approved',
  message: 'Your removal request has been approved.',
  requestId: testRequestId,
  timestamp: {
    toDate: () => new Date(),
    toMillis: () => Date.now()
  },
  isRead: false,
  link: `/requests/${testRequestId}`
};

describe('Notification Workflow Integration Tests', () => {
  // Mock API responses and Firestore operations
  beforeAll(() => {
    // Mock admin auth API
    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.includes('/api/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            uid: testAdminId,
            name: 'Admin User',
            email: 'admin@example.com',
            role: 'admin'
          })
        });
      }
      return Promise.reject(new Error('Not found'));
    }) as jest.Mock;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup Firestore mocks
    (firebaseFirestore.getFirestore as jest.Mock).mockReturnValue({});
    (firebaseFirestore.collection as jest.Mock).mockReturnValue('collection-ref');
    (firebaseFirestore.query as jest.Mock).mockReturnValue('query-ref');
    (firebaseFirestore.where as jest.Mock).mockReturnValue('where-clause');
    (firebaseFirestore.doc as jest.Mock).mockReturnValue('doc-ref');
    (firebaseFirestore.serverTimestamp as jest.Mock).mockReturnValue('server-timestamp');
    
    // Mock document retrieval for request
    (firebaseFirestore.getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => mockRequest,
      id: mockRequest.id
    });
    
    // Mock transaction for approval process
    (firebaseFirestore.runTransaction as jest.Mock).mockImplementation((db, callback) => {
      return Promise.resolve(callback({
        get: jest.fn().mockImplementation((docRef) => {
          if (docRef === 'doc-ref') { // Request document
            return {
              exists: () => true,
              data: () => mockRequest
            };
          } else { // Inventory item document
            return {
              exists: () => true,
              data: () => mockInventoryItem
            };
          }
        }),
        update: jest.fn(),
        set: jest.fn((collection, data) => {
          // Capture notification creation
          if (data.type && (data.type === 'request_approved' || data.type === 'request_rejected')) {
            mockNotification.type = data.type;
            mockNotification.message = data.message;
          }
        })
      }));
    });
    
    // Mock writeBatch for rejection process
    const mockBatch = {
      update: jest.fn(),
      set: jest.fn((collection, data) => {
        // Capture notification creation
        if (data.type && (data.type === 'request_approved' || data.type === 'request_rejected')) {
          mockNotification.type = data.type;
          mockNotification.message = data.message;
          mockNotification.adminNotes = data.adminNotes;
        }
      }),
      commit: jest.fn().mockResolvedValue(undefined)
    };
    (firebaseFirestore.writeBatch as jest.Mock).mockReturnValue(mockBatch);
    
    // Mock onSnapshot for notifications
    (firebaseFirestore.onSnapshot as jest.Mock).mockImplementation((query, callback) => {
      callback({
        forEach: (cb) => {
          cb({
            id: mockNotification.id,
            data: () => ({ ...mockNotification })
          });
        }
      });
      return jest.fn(); // Return unsubscribe function
    });
    
    // Mock updateDoc for marking notifications as read
    (firebaseFirestore.updateDoc as jest.Mock).mockResolvedValue(undefined);
    
    // Mock prompt for rejection notes
    global.prompt = jest.fn(() => 'Insufficient inventory');
  });
  
  test('Full notification workflow: approval, notification, viewing detail, marking as read', async () => {
    // Setup: Switch to admin user for approval
    const authModuleMock = require('@/lib/firebaseClient');
    authModuleMock.auth.currentUser = { uid: testAdminId };
    
    // Step 1: Admin approves request
    render(<AdminPanelPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/Pending Removal Requests/i)).toBeInTheDocument();
    });
    
    const approveButton = screen.getAllByText('Approve Request')[0];
    fireEvent.click(approveButton);
    
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Request Approved'
        })
      );
    });
    
    // Step 2: Switch to regular user and check notifications
    authModuleMock.auth.currentUser = { uid: testUserId };
    authModuleMock.auth.onAuthStateChanged.mockImplementationOnce((callback) => {
      callback({ uid: testUserId });
      return jest.fn();
    });
    
    // Clear previous renders
    document.body.innerHTML = '';
    
    // Render notification bell
    render(<UserNotificationsBell />);
    
    // Verify notification appears
    await waitFor(() => {
      // Should have unread count of 1
      expect(screen.getByText('1')).toBeInTheDocument();
    });
    
    // Open notifications
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(bellButton);
    
    await waitFor(() => {
      expect(screen.getByText('Your removal request has been approved.')).toBeInTheDocument();
      
      // Should have View Details button
      const viewDetailsButton = screen.getByText('View Details');
      expect(viewDetailsButton).toBeInTheDocument();
      
      // Click view details
      fireEvent.click(viewDetailsButton);
    });
    
    // Verify that clicking View Details called updateDoc to mark notification as read
    await waitFor(() => {
      expect(firebaseFirestore.updateDoc).toHaveBeenCalledWith(
        'doc-ref', 
        { isRead: true }
      );
    });
    
    // Step 3: Render request details page
    document.body.innerHTML = '';
    render(<RequestDetailsPage params={{ id: testRequestId }} />);
    
    // Verify request details are displayed
    await waitFor(() => {
      expect(screen.getByText('Request Details')).toBeInTheDocument();
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      expect(screen.getByText(`Quantity: 5 units`)).toBeInTheDocument();
    });
  });
  
  test('Full notification workflow: rejection with notes, notification, viewing detail', async () => {
    // Setup: Switch to admin user for rejection
    const authModuleMock = require('@/lib/firebaseClient');
    authModuleMock.auth.currentUser = { uid: testAdminId };
    
    // Step 1: Admin rejects request
    render(<AdminPanelPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/Pending Removal Requests/i)).toBeInTheDocument();
    });
    
    const rejectButton = screen.getAllByText('Reject Request')[0];
    fireEvent.click(rejectButton);
    
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Request Rejected'
        })
      );
      
      // Verify admin notes were captured in notification
      expect(mockNotification.adminNotes).toBe('Insufficient inventory');
    });
    
    // Step 2: Switch to regular user and check notifications
    authModuleMock.auth.currentUser = { uid: testUserId };
    authModuleMock.auth.onAuthStateChanged.mockImplementationOnce((callback) => {
      callback({ uid: testUserId });
      return jest.fn();
    });
    
    // Update notification type for rejection
    mockNotification.type = 'request_rejected';
    mockNotification.message = 'Your removal request has been rejected.';
    
    // Clear previous renders
    document.body.innerHTML = '';
    
    // Render notification bell
    render(<UserNotificationsBell />);
    
    // Verify notification appears and has rejection message
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });
    
    // Open notifications
    const bellButton = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(bellButton);
    
    await waitFor(() => {
      expect(screen.getByText('Your removal request has been rejected.')).toBeInTheDocument();
    });
    
    // Test marking all notifications as read
    const markAllButton = screen.getByText('Mark all as read');
    fireEvent.click(markAllButton);
    
    await waitFor(() => {
      expect(firebaseFirestore.writeBatch).toHaveBeenCalled();
      expect(firebaseFirestore.writeBatch().commit).toHaveBeenCalled();
    });
  });
});
