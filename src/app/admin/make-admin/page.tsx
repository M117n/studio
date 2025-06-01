'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AdminGuard from '@/components/AdminGuard';
import { AdminNavbar } from '@/components/AdminNavbar';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export default function MakeAdminPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [targetUid, setTargetUid] = useState('');
  const [result, setResult] = useState<{success?: boolean; message?: string; error?: string} | null>(null);
  
  const { user: currentUser, loading: authLoading } = useAuth();
  const masterAdminUid = process.env.NEXT_PUBLIC_MASTER_ADMIN_UID;

  useEffect(() => {
    if (!masterAdminUid) {
      console.error("NEXT_PUBLIC_MASTER_ADMIN_UID is not set in environment variables.");
    }
  }, [masterAdminUid]);

  const handleMakeAdmin = async () => {
    if (currentUser?.uid !== masterAdminUid) {
      toast({ title: "Unauthorized", description: "Only the Master Admin can perform this action.", variant: "destructive" });
      return;
    }
    if (!targetUid.trim()) {
      toast({
        title: "Error",
        description: "Please enter a user UID",
        variant: "destructive",
      });
      return;
    }
    if (targetUid.trim() === masterAdminUid) {
      toast({ title: "Error", description: "Master Admin cannot target their own account.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/admin/make-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: targetUid.trim() }),
      });
      
      const data = await response.json();
      
      if (!response.ok) { throw new Error(data.error || 'Failed to make user admin'); }
      
      setResult({ 
        success: true, 
        message: data.message || `User ${targetUid.trim()} has been made an admin` 
      });
      
      toast({
        title: "Success",
        description: `User with UID: ${targetUid.trim()} is now an admin`,
      });
      
      setTargetUid('');
    } catch (error: any) {
      console.error('Error making user admin:', error);
      setResult({ 
        success: false, 
        error: error.message || 'An unknown error occurred' 
      });
      
      toast({
        title: "Error",
        description: error.message || 'Failed to update user role',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <AdminGuard>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <AdminNavbar />
          <p>Loading authentication status...</p>
        </div>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <div className="min-h-screen bg-slate-50">
        <AdminNavbar />
        <div className="container mx-auto p-4 md:p-8">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Make User Admin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!masterAdminUid ? (
                <p className="text-red-600 font-semibold">Configuration Error: Master Admin UID is not set. Please contact support.</p>
              ) : currentUser?.uid === masterAdminUid ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="user-id">User ID</Label>
                    <Input
                      id="user-id"
                      value={targetUid}
                      onChange={(e) => setTargetUid(e.target.value)}
                      placeholder="Enter the user's UID"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Enter the Firebase UID of the user you want to make an admin</p>
                  </div>
                  
                  <Button 
                    onClick={handleMakeAdmin} 
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? 'Processing...' : 'Make User Admin'}
                  </Button>
                  
                  {result && (
                    <div className={`mt-4 p-3 rounded-md ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {result.success ? <p>{result.message}</p> : <p>Error: {result.error}</p>}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-red-600 font-semibold">Access Denied. Only the Master Admin can perform this action.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminGuard>
  );
}
