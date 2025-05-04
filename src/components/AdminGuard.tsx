"use client";                                                                                                                          
                                                                                                                                       
import { useEffect } from "react";                                                                                                     
import { useRouter } from "next/navigation";                                                                                           
import { useAuth } from "@/hooks/useAuth";                                                                                             
                                                                                                                                       
export default function AdminGuard({                                                                                                   
  children,                                                                                                                            
}: {                                                                                                                                   
  children: React.ReactNode;                                                                                                           
}) {                                                                                                                                   
  const { isAuthenticated, role, loading } = useAuth();                                                                                
  const router = useRouter();                                                                                                          
                                                                                                                                       
  useEffect(() => {                                                                                                                    
    if (!loading && (!isAuthenticated || role !== "admin")) {                                                                          
      router.replace("/");                                                                                                             
    }                                                                                                                                  
  }, [isAuthenticated, role, loading, router]);                                                                                        
                                                                                                                                       
  if (loading || !isAuthenticated || role !== "admin") {                                                                               
    return <p>Checking permissions…</p>;                                                                                               
  }                                                                                                                                    
                                                                                                                                       
  return <>{children}</>;
}