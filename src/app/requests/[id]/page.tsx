"use client";

import { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc, Timestamp } from 'firebase/firestore';
import { auth } from '@/lib/firebaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

interface RequestedItemDetail {
  itemId: string;
  name: string;
  quantityToRemove: number;
  unit: string;
  category?: string | null;
  imageUrl?: string | null;
}

interface RemovalRequest {
  id: string;
  userId: string;
  userName: string;
  requestedItems: RequestedItemDetail[];
  requestTimestamp: Timestamp;
  status: 'pending' | 'approved' | 'rejected';
  adminId?: string;
  adminName?: string;
  processedTimestamp?: Timestamp;
  adminNotes?: string;
}

export default function RequestDetailsPage({ params }: { params: { id: string } }) {
  const [request, setRequest] = useState<RemovalRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const requestId = params.id;

  useEffect(() => {
    const fetchRequestDetails = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          router.push('/login');
          return;
        }

        const db = getFirestore(auth.app);
        const requestRef = doc(db, 'removalRequests', requestId);
        const requestSnap = await getDoc(requestRef);
        
        if (!requestSnap.exists()) {
          setError("Request not found.");
          setLoading(false);
          return;
        }

        const requestData = requestSnap.data();
        
        // Ensure user can only see their own requests
        if (requestData.userId !== user.uid) {
          setError("You don't have permission to view this request.");
          setLoading(false);
          return;
        }

        setRequest({ id: requestSnap.id, ...requestData } as RemovalRequest);
        setLoading(false);
      } catch (err: any) {
        console.error("Error fetching request details:", err);
        setError(err.message || "An error occurred while fetching the request details.");
        setLoading(false);
      }
    };

    fetchRequestDetails();
  }, [requestId, router]);

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center">Loading request details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-red-500">{error}</p>
            <div className="mt-4 text-center">
              <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center">Request not found.</p>
            <div className="mt-4 text-center">
              <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved': return "outline"; // Changed from success to outline
      case 'rejected': return "destructive";
      default: return "default";
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Request Details</span>
            <Badge variant={getStatusBadgeVariant(request.status)}>
              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Request ID</h3>
              <p className="font-mono text-xs bg-slate-100 dark:bg-slate-800 p-1 rounded inline-block">{request.id}</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Submitted By</h3>
              <p>{request.userName}</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Request Date</h3>
              <p>{request.requestTimestamp.toDate().toLocaleString()}</p>
            </div>
            
            {request.processedTimestamp && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Processed Date</h3>
                <p>{request.processedTimestamp.toDate().toLocaleString()}</p>
              </div>
            )}

            {request.adminName && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Processed By</h3>
                <p>{request.adminName}</p>
              </div>
            )}

            <div>
              <h3 className="text-lg font-medium mt-6">Requested Items</h3>
              <ul className="divide-y">
                {request.requestedItems.map((item, index) => (
                  <li key={`${item.itemId}-${index}`} className="py-3">
                    <div className="flex justify-between">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">Quantity: {item.quantityToRemove} {item.unit}</p>
                        {item.category && <p className="text-xs text-muted-foreground">Category: {item.category}</p>}
                      </div>
                      {item.imageUrl && ( // Conditionally render the link
                        <a 
                          href={item.imageUrl} // Now only called if item.imageUrl is truthy
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          View Image
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {request.adminNotes && request.status === 'rejected' && (
              <div className="mt-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-md">
                <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">Rejection Reason:</h3>
                <p className="text-sm text-red-700 dark:text-red-400">{request.adminNotes}</p>
              </div>
            )}

            <div className="pt-4 mt-6 border-t">
              <Button variant="outline" onClick={() => router.back()} className="w-full sm:w-auto">
                Go Back
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
