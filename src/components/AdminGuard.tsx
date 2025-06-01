"use client";                                                                                                                          
                                                                                                                                       
import { useEffect } from "react";                                                                                                     
import { useRouter } from "next/navigation";                                                                                           
import { useAuth } from "@/hooks/useAuth";                                                                                             
                                                                                                                                       
export default function AdminGuard({                                                                                                   
  children,                                                                                                                            
}: {                                                                                                                                   
  children: React.ReactNode;                                                                                                           
}) {                                                                                                                                   
  const { isAuthenticated, isAdmin, loading } = useAuth();                                                                                
  const router = useRouter();                                                                                                          
                                                                                                                                       
  useEffect(() => {                                                                                                                    
    if (!loading && (!isAuthenticated || !isAdmin)) {                                                                          
      router.replace("/");                                                                                                             
    }                                                                                                                                  
  }, [isAuthenticated, isAdmin, loading, router]);                                                                                        
                                                                                                                                       
  if (loading || !isAuthenticated || !isAdmin) {                                                                               
    return <p>Checking permissions…</p>;                                                                                               
  }                                                                                                                                    
                                                                                                                                       
  return <>{children}</>;
}