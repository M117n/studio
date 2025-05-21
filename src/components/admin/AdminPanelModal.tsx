'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PendingRequestsPanel } from "./PendingRequestsPanel";
import { toast } from "@/hooks/use-toast";

export function AdminPanelModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleMakeAdmin = async () => {
    setIsLoading(true);
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
      
      toast({
        title: "Success",
        description: `User with UID: ${targetUid} is now an admin`,
      });
    } catch (error: any) {
      console.error('Error making user admin:', error);
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline"
          className="ml-2 bg-violet-100 hover:bg-violet-200 text-violet-900 border-violet-300"
        >
          Admin Panel
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto p-0">
        <div className="w-full animate-in zoom-in-95 duration-200">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-2xl font-bold">Admin Panel</DialogTitle>
            <DialogDescription>
              Manage inventory requests and user permissions.
            </DialogDescription>
          </DialogHeader>
          
          <div className="px-6 pb-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full mb-6">
                <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
                <TabsTrigger value="requests" className="flex-1">Removal Requests</TabsTrigger>
                <TabsTrigger value="users" className="flex-1">User Management</TabsTrigger>
              </TabsList>
              
              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Pending Requests</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        variant="outline" 
                        onClick={() => setActiveTab("requests")}
                        className="w-full"
                      >
                        View Requests
                      </Button>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Make User Admin</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        variant="outline" 
                        onClick={handleMakeAdmin}
                        disabled={isLoading}
                        className="w-full"
                      >
                        {isLoading ? 'Processing...' : 'Assign Admin Role'}
                      </Button>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Full Admin Dashboard</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setIsOpen(false);
                          router.push('/admin/dashboard');
                        }}
                        className="w-full"
                      >
                        Open Full Dashboard
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              {/* Requests Tab */}
              <TabsContent value="requests">
                <PendingRequestsPanel onClose={() => setIsOpen(false)} />
              </TabsContent>
              
              {/* Users Tab */}
              <TabsContent value="users">
                <Card>
                  <CardHeader>
                    <CardTitle>User Management</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      User management features will appear here.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
