'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AdminGuard from '@/components/AdminGuard';
import { AdminNavbar } from '@/components/AdminNavbar';
import { toast } from '@/hooks/use-toast';

export default function MakeAdminPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{success?: boolean; message?: string; error?: string} | null>(null);

  const handleMakeAdmin = async () => {
    setIsLoading(true);
    setResult(null);
    
    try {
      // Using the hardcoded UID as requested
      const targetUid = '9CuI7xQ8FPOscSoArVX3aC3SPoZ2';
      
      const response = await fetch('/api/admin/make-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid: targetUid }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to make user admin');
      }
      
      setResult({ 
        success: true, 
        message: data.message || `User ${targetUid} has been made an admin` 
      });
      
      toast({
        title: "Success",
        description: `User with UID: ${targetUid} is now an admin`,
      });
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
              <div className="p-4 bg-slate-100 rounded-md">
                <p className="font-mono text-sm break-all">User ID: 9CuI7xQ8FPOscSoArVX3aC3SPoZ2</p>
              </div>
              
              <Button 
                onClick={handleMakeAdmin} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Processing...' : 'Make This User Admin'}
              </Button>
              
              {result && (
                <div className={`mt-4 p-3 rounded-md ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {result.success ? (
                    <p>{result.message}</p>
                  ) : (
                    <p>Error: {result.error}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminGuard>
  );
}
