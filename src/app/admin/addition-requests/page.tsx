"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase'; // Assuming client-side firebase is configured
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext'; // Assuming an AuthContext provides user and role
import { toast } from 'react-hot-toast';
import styles from '@/styles/AdminRequests.module.css'; // Reusing styles from removal requests page

// Interfaces for Addition Request
interface RequestedAddItemDetail {
  name: string;
  category: string; // Original category from form, can be displayed but ignored for actual categorization
  subcategory: string;
  quantityToAdd: number;
  unit: string;
}

interface AdditionRequest {
  id: string; // Document ID
  userId: string;
  userName: string;
  requestedItem: RequestedAddItemDetail;
  requestTimestamp: Timestamp; // Firestore Timestamp
  status: 'pending' | 'approved' | 'rejected';
  adminId?: string;
  adminName?: string;
  processedTimestamp?: Timestamp;
  adminNotes?: string;
}

const AdminAdditionRequestsPage = () => {
  const { currentUser, userRole } = useAuth();
  const [requests, setRequests] = useState<AdditionRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<Record<string, boolean>>({}); // Track processing state for each request

  const fetchAdditionRequests = useCallback(async () => {
    if (userRole !== 'admin') {
      setError("Access denied. You must be an admin to view this page.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const q = query(collection(db, 'additionRequests'), where('status', '==', 'pending'));
      const querySnapshot = await getDocs(q);
      const fetchedRequests = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AdditionRequest));
      setRequests(fetchedRequests);
      setError(null);
    } catch (err) {
      console.error("Error fetching addition requests:", err);
      setError("Failed to fetch addition requests. Please try again later.");
      toast.error("Failed to load requests.");
    } finally {
      setLoading(false);
    }
  }, [userRole]);

  useEffect(() => {
    if (currentUser) { // Ensure user is loaded before checking role
        fetchAdditionRequests();
    }
  }, [currentUser, fetchAdditionRequests]);

  const handleApproveRequest = async (requestId: string) => {
    setProcessing(prev => ({ ...prev, [requestId]: true }));
    try {
      const response = await fetch(`/api/admin/approve-addition/${requestId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Session cookie should be automatically sent by the browser
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to approve request. Status: ${response.status}`);
      }

      toast.success(`Request ${requestId} approved! Item ID: ${result.itemId}`);
      // Refresh list or update UI optimistically
      setRequests(prevRequests => prevRequests.filter(req => req.id !== requestId));
    } catch (err: any) {
      console.error("Error approving request:", err);
      toast.error(`Failed to approve request ${requestId}: ${err.message}`);
      setError(`Failed to approve request ${requestId}: ${err.message}`);
    } finally {
      setProcessing(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    // For now, this is a placeholder. A full implementation would involve:
    // 1. A modal to input rejection reason (adminNotes).
    // 2. An API endpoint (e.g., /api/admin/reject-addition/[id]) to update status and notes.
    const adminNotes = prompt("Enter reason for rejection (optional):");
    setProcessing(prev => ({ ...prev, [requestId]: true }));
    try {
        // Example: Directly updating Firestore for simplicity, ideally use an API endpoint
        const requestRef = doc(db, 'additionRequests', requestId);
        await updateDoc(requestRef, {
            status: 'rejected',
            adminId: currentUser?.uid,
            adminName: currentUser?.displayName || currentUser?.email || 'Admin', // Use available admin info
            processedTimestamp: serverTimestamp(),
            adminNotes: adminNotes || "", 
        });
        toast.success(`Request ${requestId} rejected.`);
        setRequests(prevRequests => prevRequests.filter(req => req.id !== requestId));
    } catch (err: any) {
        console.error("Error rejecting request:", err);
        toast.error(`Failed to reject request ${requestId}: ${err.message}`);
    } finally {
        setProcessing(prev => ({ ...prev, [requestId]: false }));
    }
  };


  if (loading && !requests.length) return <div className={styles.loading}>Loading requests...</div>;
  if (error) return <div className={styles.error}>{error}</div>;
  if (userRole !== 'admin' && !loading) return <div className={styles.error}>Access Denied: You are not authorized to view this page.</div>;
  if (!requests.length && !loading) return <div className={styles.noRequests}>No pending addition requests found.</div>;

  return (
    <div className={styles.adminRequestsPage}>
      <h1>Admin - Pending Item Addition Requests</h1>
      <button onClick={fetchAdditionRequests} disabled={loading} className={styles.refreshButton}>
        Refresh Requests
      </button>
      <div className={styles.requestsGrid}>
        {requests.map(req => (
          <div key={req.id} className={styles.requestCard}>
            <h3>Request ID: {req.id}</h3>
            <p><strong>User:</strong> {req.userName} (ID: {req.userId})</p>
            <p><strong>Requested At:</strong> {new Date(req.requestTimestamp.seconds * 1000).toLocaleString()}</p>
            <h4>Requested Item Details:</h4>
            <ul>
              <li><strong>Name:</strong> {req.requestedItem.name}</li>
              <li><strong>Quantity:</strong> {req.requestedItem.quantityToAdd} {req.requestedItem.unit}</li>
              <li><strong>Subcategory:</strong> {req.requestedItem.subcategory}</li>
              <li><strong>(Original Category from form):</strong> {req.requestedItem.category}</li>
            </ul>
            <div className={styles.actions}>
              <button
                onClick={() => handleApproveRequest(req.id)}
                disabled={processing[req.id]}
                className={styles.approveButton}
              >
                {processing[req.id] ? 'Processing...' : 'Approve'}
              </button>
              <button
                onClick={() => handleRejectRequest(req.id)}
                disabled={processing[req.id]}
                className={styles.rejectButton}
              >
                {processing[req.id] ? 'Processing...' : 'Reject'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminAdditionRequestsPage;
