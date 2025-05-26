'use client';

import { useState, useEffect } from 'react';
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
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebaseClient";
import { collection, getDocs, query, where, doc, deleteDoc } from "firebase/firestore";

interface AdminUserData {
  uid: string;
  email: string;
  name?: string;
}

export function AdminPanelModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { user: currentUser, isAdmin: currentIsAdmin } = useAuth();

  const [adminUsersList, setAdminUsersList] = useState<AdminUserData[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [revokeLoading, setRevokeLoading] = useState<string | null>(null);

  const masterAdminUid = process.env.NEXT_PUBLIC_MASTER_ADMIN_UID;

  const fetchAdminUsers = async () => {
    if (!currentIsAdmin) return;
    setUsersLoading(true);
    setUsersError(null);
    try {
      const adminUsersCol = collection(db, "adminUsers");
      const q = query(adminUsersCol);
      const querySnapshot = await getDocs(q);
      const users: AdminUserData[] = [];
      querySnapshot.forEach((doc) => {
        users.push({ uid: doc.id, ...doc.data() } as AdminUserData);
      });
      setAdminUsersList(users);
    } catch (error: any) {
      console.error("Error fetching admin users:", error);
      setUsersError("Failed to load admin users. " + error.message);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === "users") {
      fetchAdminUsers();
    }
  }, [isOpen, activeTab, currentIsAdmin]);

  const handleMakeAdmin = async () => {
    setIsLoading(true);
    try {
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

  const handleRevokeAdmin = async (targetUid: string) => {
    if (!currentUser || currentUser.uid !== masterAdminUid) {
      toast({ title: "Error", description: "Only the Master Admin can revoke privileges.", variant: "destructive" });
      return;
    }
    if (targetUid === masterAdminUid) {
      toast({ title: "Error", description: "Master Admin cannot revoke their own privileges.", variant: "destructive" });
      return;
    }

    setRevokeLoading(targetUid);
    try {
      const response = await fetch('/api/admin/revoke-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: targetUid }),
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to revoke admin privileges.");
      }

      toast({ title: "Success", description: data.message || `Admin privileges revoked for user ${targetUid}` });
      
      // Remove user from local list
      setAdminUsersList(prev => prev.filter(user => user.uid !== targetUid));
      
      // The 'adminUsers' collection document is deleted by the API route.

    } catch (error: any) {
      console.error("Error revoking admin:", error);
      toast({ title: "Error", description: error.message || "Failed to revoke admin privileges.", variant: "destructive" });
    } finally {
      setRevokeLoading(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (open && activeTab === 'users') {
        fetchAdminUsers();
      }
    }}>
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
                    <CardTitle>Admin User Management</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {usersLoading && <p>Loading admin users...</p>}
                    {usersError && <p className="text-red-500">{usersError}</p>}
                    {!usersLoading && !usersError && adminUsersList.length === 0 && (
                      <p className="text-muted-foreground">No admin users found.</p>
                    )}
                    {!usersLoading && !usersError && adminUsersList.length > 0 && (
                      <ul className="space-y-2">
                        {adminUsersList.map((admin) => (
                          <li key={admin.uid} className="flex justify-between items-center p-2 border rounded">
                            <div>
                              <p className="font-semibold">{admin.name || admin.email}</p>
                              <p className="text-sm text-muted-foreground">{admin.uid}</p>
                            </div>
                            {currentUser?.uid === masterAdminUid && admin.uid !== masterAdminUid && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleRevokeAdmin(admin.uid)}
                                disabled={revokeLoading === admin.uid}
                              >
                                {revokeLoading === admin.uid ? "Revoking..." : "Revoke Admin"}
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
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
