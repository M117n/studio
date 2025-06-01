import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RequestDetailsPage from '@/app/requests/[id]/page';
import * as firebaseFirestore from 'firebase/firestore';
import * as nextNavigation from 'next/navigation';

// Mock Firebase modules
jest.mock('firebase/firestore');
jest.mock('@/lib/firebaseClient', () => ({
  auth: {
    currentUser: { uid: 'test-user-id' },
    app: {}
  }
}));

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    back: jest.fn(),
  }))
}));

// Mock request data
const mockRequest = {
  id: 'request-123',
  userId: 'test-user-id',
  userName: 'Test User',
  requestedItems: [
    {
      itemId: 'item-1',
      name: 'Test Item 1',
      quantityToRemove: 5,
      unit: 'units',
      category: 'Test Category',
      imageUrl: 'https://example.com/image.jpg'
    },
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
    toDate: () => new Date('2025-05-15T12:00:00Z')
  },
  status: 'approved',
  adminId: 'admin-123',
  adminName: 'Admin User',
  processedTimestamp: {
    toDate: () => new Date('2025-05-16T12:00:00Z')
  }
};

// Mock getDoc response
const mockGetDoc = jest.fn().mockImplementation(() => ({
  exists: () => true,
  data: () => ({ ...mockRequest }),
  id: mockRequest.id
}));

describe('RequestDetailsPage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup the mocks
    (firebaseFirestore.getFirestore as jest.Mock).mockReturnValue({});
    (firebaseFirestore.doc as jest.Mock).mockReturnValue('request-doc-ref');
    (firebaseFirestore.getDoc as jest.Mock).mockImplementation(mockGetDoc);
  });
  
  test('renders request details correctly for an approved request', async () => {
    render(<RequestDetailsPage params={{ id: 'request-123' }} />);
    
    await waitFor(() => {
      // Check for request details
      expect(screen.getByText('Request Details')).toBeInTheDocument();
      expect(screen.getByText('Approved')).toBeInTheDocument();
      expect(screen.getByText('request-123')).toBeInTheDocument();
      expect(screen.getByText('Test User')).toBeInTheDocument();
      
      // Check for requested items
      expect(screen.getByText('Requested Items')).toBeInTheDocument();
      expect(screen.getByText('Test Item 1')).toBeInTheDocument();
      expect(screen.getByText('Quantity: 5 units')).toBeInTheDocument();
      expect(screen.getByText('Test Item 2')).toBeInTheDocument();
      expect(screen.getByText('Quantity: 10 kg')).toBeInTheDocument();
      
      // Check for admin info
      expect(screen.getByText('Processed By')).toBeInTheDocument();
      expect(screen.getByText('Admin User')).toBeInTheDocument();
      
      // Check for "View Image" link for first item
      expect(screen.getByText('View Image')).toHaveAttribute('href', 'https://example.com/image.jpg');
    });
  });
  
  test('renders request details for a rejected request with admin notes', async () => {
    // Override the mock for this test to have rejection status
    const rejectedRequest = {
      ...mockRequest,
      status: 'rejected',
      adminNotes: 'Rejected due to insufficient stock'
    };
    
    (firebaseFirestore.getDoc as jest.Mock).mockImplementationOnce(() => ({
      exists: () => true,
      data: () => rejectedRequest,
      id: rejectedRequest.id
    }));
    
    render(<RequestDetailsPage params={{ id: 'request-123' }} />);
    
    await waitFor(() => {
      expect(screen.getByText('Rejected')).toBeInTheDocument();
      expect(screen.getByText('Rejection Reason:')).toBeInTheDocument();
      expect(screen.getByText('Rejected due to insufficient stock')).toBeInTheDocument();
    });
  });
  
  test('redirects to login when user is not authenticated', async () => {
    // Override auth mock for this test
    const authModuleMock = require('@/lib/firebaseClient');
    authModuleMock.auth.currentUser = null;
    
    render(<RequestDetailsPage params={{ id: 'request-123' }} />);
    
    await waitFor(() => {
      expect(nextNavigation.useRouter().push).toHaveBeenCalledWith('/login');
    });
  });
  
  test('shows error when request not found', async () => {
    // Mock getDoc to return non-existent document
    (firebaseFirestore.getDoc as jest.Mock).mockImplementationOnce(() => ({
      exists: () => false
    }));
    
    render(<RequestDetailsPage params={{ id: 'non-existent-id' }} />);
    
    await waitFor(() => {
      expect(screen.getByText('Request not found.')).toBeInTheDocument();
    });
  });
  
  test('shows error when user does not have permission', async () => {
    // Mock request with different userId than the current user
    (firebaseFirestore.getDoc as jest.Mock).mockImplementationOnce(() => ({
      exists: () => true,
      data: () => ({ 
        ...mockRequest,
        userId: 'different-user-id' 
      })
    }));
    
    render(<RequestDetailsPage params={{ id: 'request-123' }} />);
    
    await waitFor(() => {
      expect(screen.getByText("You don't have permission to view this request.")).toBeInTheDocument();
    });
  });
});
