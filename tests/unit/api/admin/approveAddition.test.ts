import { jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';

// Mocks
const mockNextResponseJson = jest.fn();
jest.mock('next/server', () => ({
  NextResponse: {
    json: mockNextResponseJson,
  },
}));

const mockVerifySessionCookie = jest.fn();
const mockGetUser = jest.fn();
const mockTransactionGet = jest.fn();
const mockTransactionSet = jest.fn();
const mockTransactionUpdate = jest.fn();
const mockRunTransaction = jest.fn(async (db, updateFunction) => {
  const transaction = {
    get: mockTransactionGet,
    set: mockTransactionSet,
    update: mockTransactionUpdate,
  };
  await updateFunction(transaction);
  return Promise.resolve();
});

const mockDoc = jest.fn();
const mockCollection = jest.fn(() => ({
  doc: mockDoc,
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
}));

jest.mock('@/lib/firebaseAdmin', () => ({
  db: {
    collection: mockCollection,
    runTransaction: mockRunTransaction,
  },
  adminAuth: {
    verifySessionCookie: mockVerifySessionCookie,
    getUser: mockGetUser,
  },
  FieldValue: {
    serverTimestamp: jest.fn(() => Timestamp.now()),
  },
}));

jest.mock('@/lib/unitConversion', () => ({
    convertUnits: jest.fn(),
}));

import { convertUnits } from '@/lib/unitConversion';

const createMockNextRequest = (cookies: Record<string, string> = {}): NextRequest => {
  const headers = new Headers();
  if (Object.keys(cookies).length > 0) {
    headers.set('cookie', Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '));
  }
  return { headers } as NextRequest;
};

let POST_handler: any;
beforeAll(async () => {
  const routeModule = await import('@/app/api/admin/approve-addition/[id]/route');
  POST_handler = routeModule.POST;
});

describe('POST /api/admin/approve-addition/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifySessionCookie.mockResolvedValue({ uid: 'admin-uid' });
    mockGetUser.mockResolvedValue({ uid: 'admin-uid', displayName: 'Admin User' });
    mockNextResponseJson.mockImplementation((body, init) => ({ status: init?.status, body }));
  });

  it('should return 401 if no session cookie is provided', async () => {
    const req = createMockNextRequest();
    await POST_handler(req, { params: { id: 'test-req-id' } });
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Unauthorized' }, { status: 401 });
  });

  it('should return 401 if session cookie is invalid', async () => {
    mockVerifySessionCookie.mockRejectedValueOnce(new Error('Invalid cookie'));
    const req = createMockNextRequest({ session: 'invalid-token' });
    await POST_handler(req, { params: { id: 'test-req-id' } });
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Unauthorized' }, { status: 401 });
  });

  it('should return 404 if addition request not found', async () => {
    mockTransactionGet.mockResolvedValueOnce({ exists: false });
    const req = createMockNextRequest({ session: 'valid-admin-token' });
    await POST_handler(req, { params: { id: 'nonexistent-req-id' } });
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Addition request not found.' }, { status: 500 });
  });

  it('should return 400 if request is not pending', async () => {
    const mockRequestData = { status: 'approved' };
    mockTransactionGet.mockResolvedValueOnce({ exists: true, data: () => mockRequestData });
    const req = createMockNextRequest({ session: 'valid-admin-token' });
    await POST_handler(req, { params: { id: 'already-processed-req-id' } });
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Request has already been approved.' }, { status: 500 });
  });

  it('should approve request and create a new item', async () => {
    const mockRequestData = {
      status: 'pending',
      userId: 'user-123',
      requestedItem: { name: 'New Item', quantityToAdd: 5, unit: 'kg', subcategory: 'fruit' },
    };
    mockTransactionGet.mockResolvedValueOnce({ exists: true, data: () => mockRequestData });
    mockTransactionGet.mockResolvedValueOnce({ empty: true }); // No existing item
    const req = createMockNextRequest({ session: 'valid-admin-token' });
    await POST_handler(req, { params: { id: 'test-req-id' } });
    expect(mockTransactionSet).toHaveBeenCalledTimes(2); // New item and notification
    expect(mockNextResponseJson).toHaveBeenCalledWith(expect.objectContaining({ message: 'Request approved successfully.' }), { status: 200 });
  });

  it('should approve request and update an existing item', async () => {
    const mockRequestData = {
      status: 'pending',
      userId: 'user-123',
      requestedItem: { name: 'Existing Item', quantityToAdd: 5, unit: 'kg', subcategory: 'fruit' },
    };
    const existingItem = { id: 'existing-item-id', data: () => ({ name: 'Existing Item', quantity: 10, unit: 'kg' }) };
    mockTransactionGet.mockResolvedValueOnce({ exists: true, data: () => mockRequestData });
    mockTransactionGet.mockResolvedValueOnce({ empty: false, docs: [existingItem] });
    const req = createMockNextRequest({ session: 'valid-admin-token' });
    await POST_handler(req, { params: { id: 'test-req-id' } });
    expect(mockTransactionUpdate).toHaveBeenCalledTimes(2); // Existing item and request
    expect(mockNextResponseJson).toHaveBeenCalledWith(expect.objectContaining({ message: 'Request approved successfully.' }), { status: 200 });
  });

  it('should return 500 if unit conversion fails', async () => {
    const mockRequestData = {
        status: 'pending',
        userId: 'user-123',
        requestedItem: { name: 'Existing Item', quantityToAdd: 5, unit: 'invalid-unit', subcategory: 'fruit' },
      };
      const existingItem = { id: 'existing-item-id', data: () => ({ name: 'Existing Item', quantity: 10, unit: 'kg' }) };
      mockTransactionGet.mockResolvedValueOnce({ exists: true, data: () => mockRequestData });
      mockTransactionGet.mockResolvedValueOnce({ empty: false, docs: [existingItem] });
      (convertUnits as jest.Mock).mockReturnValue(null);
      const req = createMockNextRequest({ session: 'valid-admin-token' });
      await POST_handler(req, { params: { id: 'test-req-id' } });
      expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Cannot convert units from invalid-unit to kg for item Existing Item.' }, { status: 500 });
  });

  it('should return 500 if Firestore transaction fails', async () => {
    mockRunTransaction.mockRejectedValueOnce(new Error('Firestore error'));
    const req = createMockNextRequest({ session: 'valid-admin-token' });
    await POST_handler(req, { params: { id: 'test-req-id' } });
    expect(mockNextResponseJson).toHaveBeenCalledWith({ error: 'Firestore error' }, { status: 500 });
  });
});