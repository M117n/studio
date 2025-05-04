import { useState, useEffect } from "react";                                                                                           
                                                                                                                                       
export function useAuth() {                                                                                                            
  const [user, setUser] = useState<{                                                                                                   
    uid: string;                                                                                                                       
    email: string;                                                                                                                     
    name?: string;                                                                                                                     
    picture?: string;                                                                                                                  
    role: "user" | "admin";                                                                                                            
  } | null>(null);                                                                                                                     
  const [loading, setLoading] = useState(true);                                                                                       
                                                                                                                                       
  useEffect(() => {                                                                                                                    
    fetch("/api/auth/me")                                                                                                              
      .then((res) => (res.ok ? res.json() : null))                                                                                     
      .then((data) => setUser(data))                                                                                                   
      .catch(() => setUser(null))                                                                                                      
      .finally(() => setLoading(false));                                                                                               
  }, []);                                                                                                                              
                                                                                                                                       
  return {                                                                                                                             
    user,                                                                                                                              
    role: user?.role || "user",                                                                                                        
    isAuthenticated: !!user,                                                                                                           
    loading,                                                                                                                           
  };                                                                                                                                   
}