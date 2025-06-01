import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminPanelPage from '@/app/admin/requests/page';
import * as firebaseFirestore from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

// Mock Firebase modules
jest.mock('firebase/firestore');
jest.mock('@/lib/firebaseClient', () => ({
  auth: {
    currentUser: { uid: 'admin-user-id' },
    app: {}
  }
}));

// Mock toast function
jest.mock('@/hooks/use-toast', () => ({
  toast: jest.fn()
}));

// Mock API response for admin user
global.fetch = jest.fn(() => 
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      uid: 'admin-user-id',
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
      picture: 'https://example.com/admin.jpg'
    })
  })
) as jest.Mock;

// Mock request data
const mockRequests = [
  {
    id: 'request-123',
    userId: 'user-1',
    userName: 'Test User',
    requestedItems: [
      {
        itemId: 'item-1',
        name: 'Test Item 1',
        quantityToRemove: 5,
        unit: 'units',
        category: 'Test Category',
        imageUrl: 'https://example.com/image.jpg'
      }
    ],
    requestTimestamp: {
      toDate: () => new Date('2025-05-15T12:00:00Z'),
      toMillis: () => Date.now() - 86400000
    },
    status: 'pending'
  },
  {
    id: 'request-456',
    userId: 'user-2',
    userName: 'Another User',
    requestedItems: [
      {
        itemId: 'item-2',
        name: 'Test Item 2',
        quantityToRemove: 10,
        unit: 'kg',
        category: null,
        imageUrl: null
      }
    ],
    requestTimestamp: {
      toDate: () => new Date('2025-05-16T12:00:00Z'),
      toMillis: () => Date.now() - 43200000
    },
    status: 'pending'
  }
];

// Mock Firestore responses
const mockOnSnapshot = jest.fn((query, callback) => {
  callback({
    forEach: (cb) => {
      mockRequests.forEach((req) => {
        cb({
          id: req.id,
          data: () => ({ ...req })
        });
      });
    }
  });
  return jest.fn(); // Return unsubscribe function
});

const mockRunTransaction = jest.fn().mockImplementation((db, callback) => {
  return Promise.resolve(callback({
    get: jest.fn().mockResolvedValue({
      exists: () => true,
      data: () => mockRequests[0]
    }),
    update: jest.fn(),
    set: jest.fn()
  }));
});

const mockCommit = jest.fn().mockResolvedValue(undefined);
const mockWriteBatch = jest.fn().mockReturnValue({
  update: jest.fn(),
  set: jest.fn(),
  commit: mockCommit
});

const mockAddDoc = jest.fn().mockResolvedValue({ id: 'new-doc-id' });

describe('AdminPanelPage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup the mocks
    (firebaseFirestore.getFirestore as jest.Mock).mockReturnValue({});
    (firebaseFirestore.collection as jest.Mock).mockReturnValue('collection-ref');
    (firebaseFirestore.query as jest.Mock).mockReturnValue('query-ref');
    (firebaseFirestore.where as jest.Mock).mockReturnValue('where-clause');
    (firebaseFirestore.onSnapshot as jest.Mock).mockImplementation(mockOnSnapshot);
    (firebaseFirestore.doc as jest.Mock).mockReturnValue('doc-ref');
    (firebaseFirestore.runTransaction as jest.Mock).mockImplementation(mockRunTransaction);
    (firebaseFirestore.writeBatch as jest.Mock).mockImplementation(mockWriteBatch);
    (firebaseFirestore.addDoc as jest.Mock).mockImplementation(mockAddDoc);
    (firebaseFirestore.serverTimestamp as jest.Mock).mockReturnValue('server-timestamp');
    
    // Reset prompt mock
    global.prompt = jest.fn(() => 'Rejection note');
  });
  
  test('renders admin panel with requests', async () => {
    render(<AdminPanelPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/Admin Panel: Pending Removal Requests/i)).toBeInTheDocument();
      expect(screen.getByText(/Request ID: request-123/i)).toBeInTheDocument();
      expect(screen.getByText(/Test User/i)).toBeInTheDocument();
      expect(screen.getByText(/Test Item 1/i)).toBeInTheDocument();
    });
  });

  test('approves request and creates notification', async () => {
    // Mock the inventory item snapshot
    (firebaseFirestore.runTransaction as jest.Mock).mockImplementationOnce((db, callback) => {
      return Promise.resolve(callback({
        get: jest.fn().mockImplementation((ref) => {
          if (ref === 'doc-ref') { // Request document
            return {
              exists: () => true,
              data: () => mockRequests[0]
            };
          } else { // Inventory item
            return {
              exists: () => true,
              data: () => ({ quantity: 20, name: 'Test Item 1' })
            };
          }
        }),
        update: jest.fn(),
        set: jest.fn()
      }));
    });
    
    render(<AdminPanelPage />);
    
    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByText(/Test User/i)).toBeInTheDocument();
    });
    
    // Click approve button on the first request
    const approveButton = screen.getAllByText('Approve Request')[0];
    fireEvent.click(approveButton);
    
    // Wait for transaction to complete
    await waitFor(() => {
      // Verify notification was created
      expect(firebaseFirestore.doc).toHaveBeenCalled();
      // Check that transaction set was called with correct data containing notification details
      const transactionSetCalls = firebaseFirestore.runTransaction.mock.calls[0][1].toString();
      expect(transactionSetCalls).toContain('notifications');
      expect(transactionSetCalls).toContain('request_approved');
      
      // Check toast confirmation
      expect(toast).toHaveBeenCalledWith({
        title: 'Request Approved',
        description: expect.stringContaining('processed, inventory updated, and user notified.')
      });
    });
  });
  
  test('rejects request and creates notification with admin notes', async () => {
    render(<AdminPanelPage />);
    
    // Wait for component to render
    await waitFor(() => {
      expect(screen.getByText(/Test User/i)).toBeInTheDocument();
    });
    
    // Click reject button on the first request
    const rejectButton = screen.getAllByText('Reject Request')[0];
    fireEvent.click(rejectButton);
    
    // Wait for batch commit to complete
    await waitFor(() => {
      // Verify notification was created with correct data
      const batchSetCalls = mockWriteBatch().set.mock.calls;
      expect(batchSetCalls.length).toBeGreaterThan(0);
      
      // Check toast confirmation
      expect(toast).toHaveBeenCalledWith({
        title: 'Request Rejected',
        description: expect.stringContaining('has been rejected and user notified.')
      });
    });
  });
  
  test('handles approval error and displays toast', async () => {
    // Mock runTransaction to throw an error
    (firebaseFirestore.runTransaction as jest.Mock).mockRejectedValueOnce(new Error('Database error'));
    
    render(<AdminPanelPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/Test User/i)).toBeInTheDocument();
    });
    
    // Click approve button
    const approveButton = screen.getAllByText('Approve Request')[0];
    fireEvent.click(approveButton);
    
    // Verify error toast
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: 'Approval Error',
        description: 'Database error',
        variant: 'destructive'
      });
    });
  });

  test('handles rejection error and displays toast', async () => {
    // Mock commit to throw error
    mockCommit.mockRejectedValueOnce(new Error('Database error'));
    
    render(<AdminPanelPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/Test User/i)).toBeInTheDocument();
    });
    
    // Click reject button
    const rejectButton = screen.getAllByText('Reject Request')[0];
    fireEvent.click(rejectButton);
    
    // Verify error toast
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: 'Rejection Error',
        description: 'Database error',
        variant: 'destructive'
      });
    });
  });
});
