import { jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminAdditionRequestsPage from '@/app/admin/addition-requests/page'; // Adjust path as needed
import { Timestamp } from 'firebase/firestore'; // For mock data

// --- Mocks Setup ---

// Mock Next.js Router
const mockRouterPush = jest.fn();
const mockRouterBack = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    back: mockRouterBack,
  }),
}));

// Mock AuthContext
const mockUseAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

// Mock Firebase Client SDK
const mockGetDocs = jest.fn();
const mockUpdateDoc = jest.fn();
const mockServerTimestamp = jest.fn(() => 'mock-server-timestamp'); // Or new Date()
jest.mock('@/lib/firebase', () => ({ // Assuming this is the client-side firebase config
  db: {
    // Mock any specific db properties if directly accessed, else mock per-function
  },
  // Individual Firestore functions need to be mocked if used directly from 'firebase/firestore'
}));
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})), // Mocked instance
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: mockGetDocs, // Used for fetching requests
  doc: jest.fn(),
  updateDoc: mockUpdateDoc, // Used for reject functionality
  serverTimestamp: mockServerTimestamp,
  Timestamp: { // Provide a mock for Timestamp if needed for constructing test data
    now: () => ({ seconds: Date.now() / 1000, nanoseconds: 0 }),
    fromDate: (date: Date) => ({ seconds: date.getTime() / 1000, nanoseconds: 0 }),
  }
}));


// Mock fetch API
global.fetch = jest.fn() as jest.Mock;

// Mock toast
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock('react-hot-toast', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));
// If using a custom hook like @/hooks/use-toast, mock that instead:
// jest.mock('@/hooks/use-toast', () => ({
//   toast: jest.fn(), // Simplified mock
// }));


// --- Test Suite ---
describe('AdminAdditionRequestsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default to admin user
    mockUseAuth.mockReturnValue({
      currentUser: { uid: 'admin-uid', displayName: 'Admin User', email: 'admin@example.com' },
      userRole: 'admin',
    });
    global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'Success', itemId: 'new-item-123' }),
    } as Response);
    // Mock window.prompt for rejection notes
    global.prompt = jest.fn(() => 'Test rejection reason');
  });

  it('should show access denied for non-admin users', async () => {
    mockUseAuth.mockReturnValue({ currentUser: { uid: 'user-uid' }, userRole: 'user' });
    render(<AdminAdditionRequestsPage />);
    expect(await screen.findByText(/Access Denied: You are not authorized to view this page./i)).toBeInTheDocument();
  });

  it('should show loading state initially', () => {
    mockUseAuth.mockReturnValue({ currentUser: { uid: 'admin-uid' }, userRole: 'admin' });
    mockGetDocs.mockReturnValue(new Promise(() => {})); // Keep it pending
    render(<AdminAdditionRequestsPage />);
    expect(screen.getByText(/Loading requests.../i)).toBeInTheDocument();
  });

  const mockRequestsData = [
    {
      id: 'req1',
      userId: 'user1',
      userName: 'User One',
      requestedItem: { name: 'Apple Seeds', quantityToAdd: 100, unit: 'seeds', subcategory: 'dry', category: 'dry' },
      requestTimestamp: Timestamp.fromDate(new Date('2023-01-01T10:00:00Z')),
      status: 'pending' as const,
    },
    {
      id: 'req2',
      userId: 'user2',
      userName: 'User Two',
      requestedItem: { name: 'Banana Sapling', quantityToAdd: 5, unit: 'piece', subcategory: 'fruit', category: 'cooler' },
      requestTimestamp: Timestamp.fromDate(new Date('2023-01-02T11:00:00Z')),
      status: 'pending' as const,
    },
  ];

  it('should display pending requests', async () => {
    mockGetDocs.mockResolvedValue({ docs: mockRequestsData.map(req => ({ id: req.id, data: () => req })) });
    render(<AdminAdditionRequestsPage />);
    await waitFor(() => expect(screen.getByText(/Request ID: req1/i)).toBeInTheDocument());
    expect(screen.getByText(/User: User One/i)).toBeInTheDocument();
    expect(screen.getByText(/Apple Seeds/i)).toBeInTheDocument();
    expect(screen.getByText(/Request ID: req2/i)).toBeInTheDocument();
    expect(screen.getByText(/User: User Two/i)).toBeInTheDocument();
    expect(screen.getByText(/Banana Sapling/i)).toBeInTheDocument();
  });

  it('should handle "Approve" button click successfully', async () => {
    mockGetDocs.mockResolvedValue({ docs: [ { id: 'req1', data: () => mockRequestsData[0] } ] });
    render(<AdminAdditionRequestsPage />);
    
    await waitFor(() => screen.getByText('Request ID: req1'));
    const approveButton = screen.getByRole('button', { name: /Approve/i });
    
    await act(async () => {
      fireEvent.click(approveButton);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/admin/approve-addition/req1', expect.objectContaining({ method: 'POST' }));
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith("Request req1 approved! Item ID: new-item-123"));
    expect(screen.queryByText(/Request ID: req1/i)).not.toBeInTheDocument(); // Optimistic UI update
  });

  it('should handle "Approve" button click with API failure', async () => {
    mockGetDocs.mockResolvedValue({ docs: [ { id: 'req1', data: () => mockRequestsData[0] } ] });
    global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'API Error' }),
        status: 500,
    } as Response);
    render(<AdminAdditionRequestsPage />);

    await waitFor(() => screen.getByText('Request ID: req1'));
    const approveButton = screen.getByRole('button', { name: /Approve/i });

    await act(async () => {
      fireEvent.click(approveButton);
    });
    
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/approve-addition/req1', expect.objectContaining({ method: 'POST' }));
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("Failed to approve request req1: API Error"));
    expect(screen.getByText(/Request ID: req1/i)).toBeInTheDocument(); // Item should still be there
  });

  it('should handle "Reject" button click successfully', async () => {
    mockGetDocs.mockResolvedValue({ docs: [ { id: 'req1', data: () => mockRequestsData[0] } ] });
    mockUpdateDoc.mockResolvedValue(undefined); // Mock successful update
    render(<AdminAdditionRequestsPage />);

    await waitFor(() => screen.getByText('Request ID: req1'));
    const rejectButton = screen.getByRole('button', { name: /Reject/i });

    await act(async () => {
      fireEvent.click(rejectButton);
    });
    
    expect(global.prompt).toHaveBeenCalledWith("Enter reason for rejection (optional):");
    expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(), // Document reference
        expect.objectContaining({
            status: 'rejected',
            adminNotes: 'Test rejection reason',
            // adminId, adminName, processedTimestamp should also be checked if possible
        })
    );
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith("Request req1 rejected."));
    expect(screen.queryByText(/Request ID: req1/i)).not.toBeInTheDocument();
  });
});
