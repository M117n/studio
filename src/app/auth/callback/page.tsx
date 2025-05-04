"use client";                                                                                                                          
                                                                                                                                       
import { useEffect } from "react";                                                                                                     
import { getRedirectResult } from "firebase/auth";                                                                                     
import { auth } from "@/lib/initFirebase";                                                                                             
import { useRouter } from "next/navigation";                                                                                           
                                                                                                                                       
export default function AuthCallback() {                                                                                               
  const router = useRouter();                                                                                                          
                                                                                                                                       
  useEffect(() => {                                                                                                                    
    getRedirectResult(auth)                                                                                                            
      .then(async (result) => {                                                                                                        
        if (result?.user) {                                                                                                            
          const idToken = await result.user.getIdToken();                                                                              
          await fetch("/api/auth/sessionLogin", {                                                                                      
            method: "POST",                                                                                                            
            headers: { "Content-Type": "application/json" },                                                                           
            body: JSON.stringify({ idToken }),                                                                                         
            credentials: "include",                                                                                                    
          });                                                                                                                          
          router.replace("/");                                                                                                         
        } else {                                                                                                                       
          router.replace("/auth/login");                                                                                               
        }                                                                                                                              
      })                                                                                                                               
      .catch(() => {                                                                                                                   
        router.replace("/auth/login");                                                                                                 
      });                                                                                                                              
  }, [router]);                                                                                                                        
                                                                                                                                       
  return <p>Processing login…</p>;                                                                                                     
}  