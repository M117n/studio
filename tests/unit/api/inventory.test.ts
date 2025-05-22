import { jest } from '@jest/globals';
import type { InventoryItem, InventoryItemData } from '@/types/inventory';
import { NextRequest } from 'next/server';

// --- Mocks Setup ---

// Mock next/server
jest.mock('next/server', () => {
  const originalModule = jest.requireActual('next/server') as any;
  return {
    ...originalModule,
    NextResponse: {
      json: jest.fn((body: any, init?: { status?: number; headers?: any }) => {
        return {
          status: init?.status || 200,
          headers: init?.headers || {},
          json: async () => body, // Make json an async function
          _body: body, // Store body for inspection if needed
        };
      }),
    },
  };
});

// Mock firebaseAdmin
const mockVerifySessionCookie = jest.fn();
const mockCollectionGet = jest.fn();
const mockDocGet = jest.fn();
const mockDocSet = jest.fn();
const mockDocUpdate = jest.fn();
const mockDocDelete = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn();

const mockDoc = jest.fn((docId?: string) => ({
  id: docId || 'test-doc-id', // Default or passed ID
  get: mockDocGet,
  set: mockDocSet,
  update: mockDocUpdate,
  delete: mockDocDelete,
}));

const mockCollection = jest.fn((collectionName: string) => {
  if (collectionName === 'inventory') {
    return {
      get: mockCollectionGet,
      doc: mockDoc,
    };
  }
  if (collectionName === 'changeLogs') {
    return {
      doc: jest.fn().mockReturnThis(), // uid
      collection: jest.fn().mockReturnThis(), // events
      doc: mockDoc, // event id (for setting the log)
    };
  }
  return {
    get: jest.fn(),
    doc: mockDoc,
    collection: jest.fn().mockReturnThis(),
  };
});

const mockBatch = {
  set: mockBatchSet,
  update: mockBatchUpdate,
  delete: mockBatchDelete,
  commit: mockBatchCommit,
};

jest.mock('@/lib/firebaseAdmin', () => ({
  db: {
    collection: mockCollection,
    batch: () => mockBatch, // Firestore batch
  },
  adminAuth: {
    verifySessionCookie: mockVerifySessionCookie,
  },
  // Mock FieldValue.serverTimestamp() if it's used directly, otherwise not strictly needed for these tests
  // For example, if used in log objects directly in the route, otherwise the mockSet/mockBatchSet handles it.
  FieldValue: {
    serverTimestamp: jest.fn(() => new Date()), // Or any placeholder
  },
}));


// --- Helper Functions ---
const createMockRequest = (
  method: string = 'GET',
  cookies: Record<string, string> = {},
  body: any = null,
  params: Record<string, string> = {}
): NextRequest => {
  const headers = new Headers();
  if (Object.keys(cookies).length > 0) {
    headers.set('cookie', Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '));
  }

  const req = {
    method,
    headers,
    json: async () => body,
    nextUrl: { searchParams: new URLSearchParams() }, // For query params if any
    // other properties a NextRequest might have if needed by the handlers
  } as unknown as NextRequest;
  
  // For dynamic routes like /api/inventory/[id]
  // The actual handlers receive { params: { id: 'value' } } as a second argument
  // This helper is for the Request object itself. The test will pass params separately.
  return req;
};


// --- Import Route Handlers After Mocks ---
// Dynamically require them to ensure mocks are applied
let GET_ALL: any, POST_ITEM: any;
let GET_ITEM_BY_ID: any, PATCH_ITEM_BY_ID: any, DELETE_ITEM_BY_ID: any;

beforeAll(() => {
  const inventoryRoutes = require('@/app/api/inventory/route');
  GET_ALL = inventoryRoutes.GET;
  POST_ITEM = inventoryRoutes.POST;

  const inventoryIdRoutes = require('@/app/api/inventory/[id]/route');
  GET_ITEM_BY_ID = inventoryIdRoutes.GET;
  PATCH_ITEM_BY_ID = inventoryIdRoutes.PATCH;
  DELETE_ITEM_BY_ID = inventoryIdRoutes.DELETE;
});


// --- Test Suites ---
describe('Inventory API Routes', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    mockVerifySessionCookie.mockResolvedValue({ uid: 'test-uid' }); // Default to valid session
  });

  describe('GET /api/inventory', () => {
    it('should return 401 if no session cookie is provided', async () => {
      const req = createMockRequest('GET');
      mockVerifySessionCookie.mockRejectedValueOnce(new Error('No session cookie'));
      
      const response = await GET_ALL(req);
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('should return inventory items for an authenticated user', async () => {
      const mockItems: InventoryItem[] = [
        { id: 'item1', name: 'Test Item 1', quantity: 10, unit: 'pcs', category: 'test', subcategory: 'test' },
      ];
      mockCollectionGet.mockResolvedValue({
        docs: mockItems.map(item => ({ id: item.id, data: () => item })),
      });
      const req = createMockRequest('GET', { session: 'valid-token' });
      
      const response = await GET_ALL(req);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual(mockItems);
      expect(mockVerifySessionCookie).toHaveBeenCalledWith('valid-token', true);
      expect(mockCollection).toHaveBeenCalledWith('inventory');
      expect(mockCollectionGet).toHaveBeenCalled();
    });

    it('should return specific error format on database failure', async () => {
      mockCollectionGet.mockRejectedValueOnce({ code: 'DB_ERROR', message: 'Database unavailable' });
      const req = createMockRequest('GET', { session: 'valid-token' });

      const response = await GET_ALL(req);
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('Failed to fetch inventory');
      expect(body.errorCode).toBe('DB_ERROR');
      expect(body.errorMessage).toBe('Database unavailable');
    });
  });

  // Placeholder for POST tests (to be detailed in next step)
  describe('POST /api/inventory', () => {
    it('should return 401 if no session cookie is provided', async () => {
      const newItemData: InventoryItemData = { name: 'New Item', quantity: 100, unit: 'kg', category: 'cat', subcategory: 'subcat' };
      const req = createMockRequest('POST', {}, newItemData); // No session cookie
      mockVerifySessionCookie.mockRejectedValueOnce(new Error('No session cookie'));
      
      const response = await POST_ITEM(req);
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('should create an item and return 201 for valid data and auth', async () => {
      const newItemData: InventoryItemData = { name: 'New Item', quantity: 100, unit: 'kg', category: 'cat', subcategory: 'subcat' };
      const req = createMockRequest('POST', { session: 'valid-token' }, newItemData);
      mockDoc.mockImplementationOnce((idArg) => ({ // Mock for inventory doc
        id: idArg || 'new-generated-id',
        set: mockDocSet.mockResolvedValue(undefined),
      }));
       mockDoc.mockImplementationOnce(() => ({ // Mock for log doc
        id: 'log-id',
        set: mockDocSet.mockResolvedValue(undefined),
      }));


      const response = await POST_ITEM(req);
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body).toMatchObject({ ...newItemData, id: expect.any(String) });
      expect(mockVerifySessionCookie).toHaveBeenCalledWith('valid-token', true);
      expect(mockCollection).toHaveBeenCalledWith('inventory');
      expect(mockDocSet).toHaveBeenCalledWith(newItemData); // Item data
      expect(mockCollection).toHaveBeenCalledWith('changeLogs');
      // Basic log check, detailed checks can be added
      expect(mockDocSet).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE', name: 'New Item' }));
    });

    // Add more POST tests for validation here
    const invalidPostCases = [
      { data: { name: '', quantity: 1, unit: 'u', category: 'c', subcategory: 's' }, detail: 'Name must be a non-empty string.' },
      { data: { name: 'n', quantity: 0, unit: 'u', category: 'c', subcategory: 's' }, detail: 'Quantity must be a number greater than 0.' },
      { data: { name: 'n', quantity: 1, unit: '', category: 'c', subcategory: 's' }, detail: 'Unit must be a non-empty string.' },
      { data: { name: 'n', quantity: 1, unit: 'u', category: '', subcategory: 's' }, detail: 'Category must be a non-empty string.' },
      { data: { name: 'n', quantity: 1, unit: 'u', category: 'c', subcategory: '' }, detail: 'Subcategory must be a non-empty string.' },
      { data: { name: 'n', quantity: 1, unit: 'u', category: 'c' /* missing subcategory */ }, detail: 'Subcategory must be a non-empty string.'}, // Assuming string type check catches undefined
    ];

    invalidPostCases.forEach(tc => {
      it(`should return 400 for invalid POST data (${tc.detail})`, async () => {
        const req = createMockRequest('POST', { session: 'valid-token' }, tc.data);
        const response = await POST_ITEM(req);
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Invalid inventory item data');
        expect(body.details).toBe(tc.detail);
      });
    });
  });

  // Placeholder for GET /api/inventory/[id] tests
  describe('GET /api/inventory/[id]', () => {
    it('should return 401 if no session cookie is provided', async () => {
      const req = createMockRequest('GET');
      mockVerifySessionCookie.mockRejectedValueOnce(new Error('No session cookie'));
      
      const response = await GET_ITEM_BY_ID(req, { params: { id: 'item1' } });
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('should return item data for valid id and auth', async () => {
      const itemData: InventoryItemData = { name: 'Fetched Item', quantity: 10, unit: 'pcs', category: 'cat', subcategory: 'sub' };
      mockDocGet.mockResolvedValue({ exists: true, id: 'item1', data: () => itemData });
      const req = createMockRequest('GET', { session: 'valid-token' });

      const response = await GET_ITEM_BY_ID(req, { params: { id: 'item1' } });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ id: 'item1', ...itemData });
      expect(mockVerifySessionCookie).toHaveBeenCalledWith('valid-token', true);
      expect(mockCollection).toHaveBeenCalledWith('inventory');
      expect(mockDoc).toHaveBeenCalledWith('item1');
      expect(mockDocGet).toHaveBeenCalled();
    });

    it('should return 404 if item not found', async () => {
      mockDocGet.mockResolvedValue({ exists: false });
      const req = createMockRequest('GET', { session: 'valid-token' });

      const response = await GET_ITEM_BY_ID(req, { params: { id: 'nonexistent' } });
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Not found');
    });
  });

  // Placeholder for PATCH /api/inventory/[id] tests
  describe('PATCH /api/inventory/[id]', () => {
    const itemId = 'patch-item-id';
    const originalItemData: InventoryItemData = { name: 'Original Name', quantity: 10, unit: 'pcs', category: 'orig-cat', subcategory: 'orig-sub' };

    beforeEach(() => {
      // Default successful fetch for PATCH's pre-fetch for logging
      mockDocGet.mockResolvedValue({ exists: true, id: itemId, data: () => originalItemData });
    });
    
    it('should return 401 if no session cookie is provided', async () => {
      const req = createMockRequest('PATCH', {}, { name: 'Updated Name' });
      mockVerifySessionCookie.mockRejectedValueOnce(new Error('No session cookie'));
      
      const response = await PATCH_ITEM_BY_ID(req, { params: { id: itemId } });
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('should update an item and return full updated data for valid patch', async () => {
      const patchData = { name: 'Updated Name', quantity: 15 };
      const req = createMockRequest('PATCH', { session: 'valid-token' }, patchData);
      
      // Mock batch operations
      mockBatchCommit.mockResolvedValue(undefined);

      const response = await PATCH_ITEM_BY_ID(req, { params: { id: itemId } });
      expect(response.status).toBe(200); // Default status for NextResponse.json is 200
      const body = await response.json();
      
      const expectedUpdatedItem = { id: itemId, ...originalItemData, ...patchData };
      expect(body).toEqual(expectedUpdatedItem);
      
      expect(mockVerifySessionCookie).toHaveBeenCalledWith('valid-token', true);
      expect(mockDocGet).toHaveBeenCalledTimes(1); // For logging pre-fetch
      expect(mockBatchUpdate).toHaveBeenCalledWith(mockDoc(itemId), patchData); // Ensure doc(itemId) is passed to batch update
      expect(mockBatchSet).toHaveBeenCalled(); // For the log
      expect(mockBatchCommit).toHaveBeenCalled();
    });
    
    it('should return 404 if item to patch is not found (during pre-fetch for logging)', async () => {
      mockDocGet.mockResolvedValue({ exists: false }); // Item does not exist
      const patchData = { name: 'Updated Name' };
      const req = createMockRequest('PATCH', { session: 'valid-token' }, patchData);

      const response = await PATCH_ITEM_BY_ID(req, { params: { id: itemId } });
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Item not found to update');
    });

    const invalidPatchCases = [
      { data: { name: '' }, detail: 'Name must be a non-empty string.' },
      { data: { quantity: 0 }, detail: 'Quantity must be a number greater than 0.' },
      { data: { unit: '' }, detail: 'Unit must be a non-empty string.' },
      { data: { category: '' }, detail: 'Category must be a non-empty string.' },
      { data: { subcategory: '' }, detail: 'Subcategory must be a non-empty string.' },
      { data: {}, detail: 'Patch data cannot be empty.'}
    ];

    invalidPatchCases.forEach(tc => {
      it(`should return 400 for invalid PATCH data (${tc.detail})`, async () => {
        const req = createMockRequest('PATCH', { session: 'valid-token' }, tc.data);
        const response = await PATCH_ITEM_BY_ID(req, { params: { id: itemId } });
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Invalid patch data');
        expect(body.details).toBe(tc.detail);
      });
    });

    it('should correctly log updated and original fields', async () => {
      const patchData = { name: 'Patched Name', quantity: 20 }; // Unit, category, subcategory remain original
      const req = createMockRequest('PATCH', { session: 'valid-token' }, patchData);
      mockBatchCommit.mockResolvedValue(undefined);

      await PATCH_ITEM_BY_ID(req, { params: { id: itemId } });

      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.anything(), // Log document reference
        expect.objectContaining({
          action: 'UPDATE',
          userId: 'test-uid',
          name: 'Patched Name', // Patched
          quantity: 20,        // Patched
          unit: originalItemData.unit, // Original
          category: originalItemData.category, // Original
          subcategory: originalItemData.subcategory, // Original
          // timestamp: expect.any(Date) // FieldValue.serverTimestamp() mocked to new Date()
        })
      );
    });
  });
  
  // Placeholder for DELETE /api/inventory/[id] tests
  // The original tests for PUT and DELETE seem to be using methods not available in the current code (PUT, DELETE returning {success: true})
  // I will adapt them if these methods are re-added or remove/update them based on current handlers.
  // For now, focusing on GET, POST, PATCH as per recent changes.
  // The original DELETE test:
  // it('DELETE should remove an inventory item', async () => { ... });
  // If DELETE is part of the scope, it needs similar auth and logging tests.
});