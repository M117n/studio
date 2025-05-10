import { jest } from '@jest/globals';
import type { InventoryItemData } from '@/types/inventory';

jest.mock('next/server', () => {
  /** Minimal stand‑in for Next.js’ real NextResponse */
  function MockNextResponse(
    body: any = null,
    init: { status?: number; headers?: any } = {},
  ) {
    return {
      status: init.status ?? 200,
      headers: init.headers ?? {},
      /* keep the body so callers can read it later if they want */
      _body: body,
      json: async () => body,
    };
  }

  /** Static helper that Next.js exposes */
  MockNextResponse.json = (
    body: any,
    init: { status?: number; headers?: any } = {},
  ) => new MockNextResponse(body, init);

  return { NextResponse: MockNextResponse };
});

type FirestoreDocs = { id: string; data: () => InventoryItemData }[];

// Mock Next.js server response
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: { status?: number; headers?: any }) => {
      return {
        status: init?.status || 200,
        headers: init?.headers || {},
        json: async () => body,
      };
    },
  },
}));

// Mock the Firestore database
const mockGet    = jest.fn<() => Promise<{ docs: FirestoreDocs }>>();
const mockSet    = jest.fn<(...args: any[]) => Promise<void>>();
const mockUpdate = jest.fn<(...args: any[]) => Promise<void>>();
const mockDelete = jest.fn<(...args: any[]) => Promise<void>>();

// Mock collection behavior
const mockInventoryCollection = {
  get: mockGet,
  doc: jest.fn(() => ({
    id: 'test-id',
    set: mockSet,
    update: mockUpdate,
    delete: mockDelete,
  })),
};
const mockLogsCollection = {
  doc: jest.fn(() => ({ set: mockSet })),
};
const mockCollection = jest.fn((name: string) => {
  if (name === 'inventory') return mockInventoryCollection;
  if (name === 'logs') return mockLogsCollection;
  return { get: jest.fn(), doc: jest.fn(() => ({ set: jest.fn() })) };
});

// Replace the db export from firebaseAdmin
jest.mock('@/lib/firebaseAdmin', () => ({ db: { collection: mockCollection } }));

// After mocking dependencies, import the API route handlers
const { GET, POST } = require('@/app/api/inventory/route');
const itemRoute = require('@/app/api/inventory/[id]/route');

describe('Inventory API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET should return inventory items', async () => {
    // Arrange: mock snapshot with one document
    const mockDocs = [
      { id: 'doc1', data: () => ({ name: 'Apple', quantity: 10, unit: 'kg', category: 'dry', subcategory: 'other' }) },
    ];
    mockGet.mockResolvedValue({ docs: mockDocs as FirestoreDocs });

    // Act: measure time and invoke GET
    const start = Date.now();
    const response = await GET();
    const duration = Date.now() - start;
    const result = await response.json();

    // Assert: correct status and data
    // Response should have status and json() method
    expect(typeof response.json).toBe('function');
    expect(response.status).toBe(200);
    expect(result).toEqual([
      { id: 'doc1', name: 'Apple', quantity: 10, unit: 'kg', category: 'dry', subcategory: 'other' },
    ]);
    // Response time should be a number under reasonable threshold
    expect(typeof duration).toBe('number');
    expect(duration).toBeLessThan(1000);
    // Ensure collection was queried
    expect(mockCollection).toHaveBeenCalledWith('inventory');
    expect(mockGet).toHaveBeenCalled();
  });

  it('POST should create a new inventory item and log it', async () => {
    // Arrange: mock request with valid data
    const data: InventoryItemData = { name: 'Orange', quantity: 5, unit: 'kg', category: 'dry', subcategory: 'other' };
    const mockRequest = { json: jest.fn<() => Promise<InventoryItemData>>().mockResolvedValue(data),
    } as unknown as Request;
    // Act
    const response = await POST(mockRequest);
    const result = await response.json();

    // Assert: status and response shape
    expect(response.status).toBe(201);
    expect(result).toMatchObject({ id: 'test-id', ...data });
    // Ensure collections and methods called
    expect(mockCollection).toHaveBeenCalledWith('inventory');
    expect(mockCollection).toHaveBeenCalledWith('logs');
    expect(mockSet).toHaveBeenCalled();
  });

  it('PUT should update an existing inventory item', async () => {
    // Arrange: mock request and params
    const updated: InventoryItemData = { name: 'Banana', quantity: 3, unit: 'kg', category: 'dry', subcategory: 'other' };
    const mockReq = { json: jest.fn<() => Promise<InventoryItemData>>().mockResolvedValue(updated),
    } as unknown as Request;
    const ctx = { params: { id: 'test-id' } };

    // Act
    const response = await itemRoute.PUT(mockReq, ctx as any);
    const result = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(result).toMatchObject({ id: 'test-id', ...updated });
    expect(mockCollection).toHaveBeenCalledWith('inventory');
    expect(mockUpdate).toHaveBeenCalledWith(updated);
  });

  it('DELETE should remove an inventory item', async () => {
    // Arrange
    const ctx = { params: { id: 'test-id' } };
    // Act
    const response = await itemRoute.DELETE({} as Request, ctx as any);
    const result = await response.json();
  
    // Assert
    expect(response.status).toBe(200); // Changed from 204 to 200
    expect(result).toEqual({ success: true, id: 'test-id' }); // Check response body
    expect(mockCollection).toHaveBeenCalledWith('inventory');
    expect(mockDelete).toHaveBeenCalled();
  });
});