import { jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore'; // For Timestamp type

// --- Mocks Setup ---

// Mock next/server
const mockNextResponseJson = jest.fn();
jest.mock('next/server', () => ({
  NextResponse: {
    json: mockNextResponseJson,
  },
}));

// Mock firebaseAdmin
const mockVerifySessionCookie = jest.fn();
const mockGetUser = jest.fn();
const mockTransactionGet = jest.fn();
const mockTransactionSet = jest.fn();
const mockTransactionUpdate = jest.fn();
const mockRunTransaction = jest.fn(async (db: any, updateFunction: (transaction: any) => Promise<any>) => {
  // Simulate transaction execution
  const transaction = {
    get: mockTransactionGet,
    set: mockTransactionSet,
    update: mockTransactionUpdate,
  };
  return updateFunction(transaction);
});

const mockDoc = jest.fn();
const mockCollection = jest.fn(() => ({
  doc: mockDoc,
}));

jest.mock('@/lib/firebaseAdmin', () => ({
  db: {
    collection: mockCollection,
    runTransaction: mockRunTransaction,
    // FieldValue.serverTimestamp() is used in the route, mock it if needed or ensure it doesn't break tests
  },
  adminAuth: {
    verifySessionCookie: mockVerifySessionCookie,
    getUser: mockGetUser,
  },
  FieldValue: { // Mock FieldValue.serverTimestamp()
    serverTimestamp: jest.fn(() => 'mock-server-timestamp'), // Or new Date()
  },
}));

// Mock @/types/inventory specifically for getMainCategory if needed,
// but the route imports it directly, so it will use the real one.
// For controlled testing, we might mock it:
// jest.mock('@/types/inventory', () => ({
//   ...jest.requireActual('@/types/inventory'), // Keep original exports
//   getMainCategory: jest.fn(),
// }));
// const { getMainCategory: mockGetMainCategory } = require('@/types/inventory');


// --- Helper to create NextRequest ---
const createMockNextRequest = (cookies: Record<string, string> = {}): NextRequest => {
  const headers = new Headers();
  if (Object.keys(cookies).length > 0) {
    headers.set('cookie', Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '));
  }
  return {
    headers,
    // other properties if needed by the handler
  } as NextRequest;
};

// --- Import Route Handler ---
// Must be done after mocks are set up
let POST_handler: any;
beforeAll(async () => {
  const routeModule = await import('@/app/api/admin/approve-addition/[id]/route');
  POST_handler = routeModule.POST;
});


// --- Test Suite ---
describe('POST /api/admin/approve-addition/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default successful responses for mocks
    mockVerifySessionCookie.mockResolvedValue({ uid: 'admin-uid' });
    mockGetUser.mockResolvedValue({ 
      uid: 'admin-uid', 
      customClaims: { isAdmin: true },
      displayName: 'Admin User' 
    });
    mockNextResponseJson.mockImplementation((body, init) => ({ // Make it return something inspectable
        _body: body,
        _status: init?.status,
        json: async () => body,
        status: init?.status || 200,
    }));
  });

  it('should return 401 if no session cookie is provided', async () => {
    const req = createMockNextRequest(); // No cookie
    await POST_handler(req, { params: { id: 'test-req-id' } });
    expect(mockNextResponseJson).toHaveBeenCalledWith(
      { error: "Unauthorized: No session cookie" },
      { status: 401 }
    );
  });

  it('should return 401 if session cookie is invalid', async () => {
    mockVerifySessionCookie.mockRejectedValueOnce(new Error('Invalid cookie'));
    const req = createMockNextRequest({ session: 'invalid-token' });
    await POST_handler(req, { params: { id: 'test-req-id' } });
    expect(mockNextResponseJson).toHaveBeenCalledWith(
      { error: "Unauthorized: Invalid session cookie" },
      { status: 401 }
    );
  });

  it('should return 403 if user is not an admin', async () => {
    mockGetUser.mockResolvedValueOnce({ uid: 'user-uid', customClaims: {} }); // Not an admin
    const req = createMockNextRequest({ session: 'valid-user-token' });
    await POST_handler(req, { params: { id: 'test-req-id' } });
    expect(mockNextResponseJson).toHaveBeenCalledWith(
      { error: "Forbidden: User is not an admin" },
      { status: 403 }
    );
  });

  it('should return 404 if addition request not found', async () => {
    mockTransactionGet.mockResolvedValueOnce({ exists: false });
    const req = createMockNextRequest({ session: 'valid-admin-token' });
    await POST_handler(req, { params: { id: 'nonexistent-req-id' } });
    expect(mockNextResponseJson).toHaveBeenCalledWith(
      { error: "Addition request not found." },
      { status: 404 }
    );
  });

  it('should return 400 if request is not pending', async () => {
    const mockRequestData = {
      status: 'approved', // Not pending
      userId: 'user-123',
      userName: 'Test User',
      requestedItem: { name: 'Test Item', quantityToAdd: 1, unit: 'kg', subcategory: 'fruit', category: 'cooler' },
      requestTimestamp: Timestamp.now(),
    };
    mockTransactionGet.mockResolvedValueOnce({ exists: true, data: () => mockRequestData });
    const req = createMockNextRequest({ session: 'valid-admin-token' });
    await POST_handler(req, { params: { id: 'already-processed-req-id' } });
    expect(mockNextResponseJson).toHaveBeenCalledWith(
      { error: "Request already processed with status: approved." },
      { status: 400 }
    );
  });
  
  it('should return 400 if getMainCategory fails to determine category', async () => {
    const mockRequestData = {
      status: 'pending',
      userId: 'user-123',
      userName: 'Test User',
      requestedItem: { name: 'Test Item', quantityToAdd: 1, unit: 'kg', subcategory: 'unknown-subcategory' as any, category: 'some-original-category' },
      requestTimestamp: Timestamp.now(),
    };
    mockTransactionGet.mockResolvedValueOnce({ exists: true, data: () => mockRequestData });
    // The actual getMainCategory will be called. If 'unknown-subcategory' is truly unhandled, it will return undefined.
    
    const req = createMockNextRequest({ session: 'valid-admin-token' });
    await POST_handler(req, { params: { id: 'category-fail-req-id' } });
    
    expect(mockNextResponseJson).toHaveBeenCalledWith(
      { error: "Could not determine main category for subcategory: unknown-subcategory" },
      { status: 400 }
    );
  });


  it('should successfully approve a pending request', async () => {
    const requestId = 'pending-req-id';
    const mockRequestData = {
      status: 'pending',
      userId: 'user-123',
      userName: 'Test User',
      requestedItem: { name: 'Apple', quantityToAdd: 10, unit: 'kg', subcategory: 'fruit', category: 'cooler' }, // 'fruit' should map to 'cooler'
      requestTimestamp: Timestamp.now(),
    };
    mockTransactionGet.mockResolvedValueOnce({ exists: true, data: () => mockRequestData });
    
    // Mock the doc reference for the new inventory item
    const mockNewInventoryItemDocRef = { id: 'new-item-id' };
    mockDoc.mockImplementation((path?: string) => {
      if (path === requestId) return { /* existing request doc ref */ }; // For additionRequestRef
      return mockNewInventoryItemDocRef; // For newInventoryItemRef
    });


    const req = createMockNextRequest({ session: 'valid-admin-token' });
    await POST_handler(req, { params: { id: requestId } });

    // Verify inventory item creation
    expect(mockTransactionSet).toHaveBeenCalledWith(
      mockNewInventoryItemDocRef, // Check if this is the correct ref
      expect.objectContaining({
        name: 'Apple',
        quantity: 10,
        unit: 'kg',
        subcategory: 'fruit',
        category: 'cooler', // Derived category
      })
    );

    // Verify addition request update
    expect(mockTransactionUpdate).toHaveBeenCalledWith(
      expect.anything(), // The additionRequestRef
      expect.objectContaining({
        status: 'approved',
        adminId: 'admin-uid',
        adminName: 'Admin User',
        processedTimestamp: 'mock-server-timestamp',
      })
    );
    
    expect(mockCollection).toHaveBeenCalledWith('inventory');
    expect(mockCollection).toHaveBeenCalledWith('additionRequests');

    expect(mockNextResponseJson).toHaveBeenCalledWith(
      { message: 'Addition request approved successfully', itemId: 'new-item-id' },
      { status: 200 }
    );
  });

  it('should return 500 if Firestore transaction fails', async () => {
    mockRunTransaction.mockRejectedValueOnce(new Error('Firestore transaction failed'));
    const req = createMockNextRequest({ session: 'valid-admin-token' });
    await POST_handler(req, { params: { id: 'test-req-id' } });
    expect(mockNextResponseJson).toHaveBeenCalledWith(
      { error: 'Failed to approve addition request', details: 'Firestore transaction failed' },
      { status: 500 }
    );
  });
});
