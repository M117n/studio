import { NextRequest, NextResponse } from 'next/server';
import { db, adminAuth } from '@/lib/firebaseAdmin'; // Assuming firebaseAdmin is correctly set up
import { FieldValue } from 'firebase-admin/firestore';
import { getMainCategory } from '@/types/inventory'; // Assuming this path is correct
import type { InventoryItemData, Unit, SubCategory } from '@/types/inventory';
import type { AdditionRequestDoc } from '@/types/admin'; // Assuming AdditionRequestDoc is here

interface AdminUser {
  uid: string;
  email?: string;
  displayName?: string;
  customClaims?: { [key: string]: any };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json(
    {
      error: 'This endpoint is deprecated and should not be used.',
      message: 'Please use the admin approval interface in the /admin/requests panel, which contains the correct logic for handling item stacking and approvals.',
    },
    { status: 410 } // 410 Gone status indicates the resource is permanently unavailable
  );
}
