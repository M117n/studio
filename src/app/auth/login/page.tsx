"use client";                                                                                                                          
                                                                                                                                       
import { useEffect } from "react";                                                                                                     
import * as firebaseui from "firebaseui";                                                                                              
import "firebaseui/dist/firebaseui.css";                                                                                               
import { auth } from "@/lib/initFirebase";                                                                                             
import { GoogleAuthProvider, GithubAuthProvider, User } from "firebase/auth";                                                                
import { useRouter } from "next/navigation";                                                                                           
                                                                                                                                       
export default function LoginPage() {                                                                                                  
  const router = useRouter();                                                                                                          
                                                                                                                                       
  useEffect(() => {                                                                                                                    
    const ui =                                                                                                                         
      firebaseui.auth.AuthUI.getInstance() ||                                                                                          
      new firebaseui.auth.AuthUI(auth);                                                                                                
                                                                                                                                       
    ui.start("#firebaseui-auth-container", {                                                                                           
      callbacks: {                                                                                                                     
        signInSuccessWithAuthResult: async ({ user }: {user: User}) => {                                                                             
          const idToken = await user.getIdToken();                                                                                     
          await fetch("/api/auth/sessionLogin", {                                                                                      
            method: "POST",                                                                                                            
            headers: { "Content-Type": "application/json" },                                                                           
            body: JSON.stringify({ idToken }),                                                                                         
            credentials: "include",                                                                                                    
          });                                                                                                                         
          router.replace("/");                                                                                                         
          return false;                                                                                                                
        },                                                                                                                             
      },                                                                                                                               
      signInOptions: [                                                                                                                 
        GoogleAuthProvider.PROVIDER_ID,                                                                                                
        GithubAuthProvider.PROVIDER_ID,                                                                                                
        firebaseui.auth.EmailAuthProvider.PROVIDER_ID,                                                                                
      ],                                                                                                                               
      signInFlow: "popup",                                                                                                             
    });                                                                                                                                
  }, [router]);                                                                                                                        
                                                                                                                                       
  return <div id="firebaseui-auth-container" />;                                                                                       
}                                                                                                                                                           