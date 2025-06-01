import { useState, useEffect } from "react";
import { auth } from "@/lib/firebaseClient"; 
import { User } from "firebase/auth"; 

type Role = "user" | "admin";

interface ServerUser { 
  uid: string;
  email: string;
  name?: string;
  picture?: string;
}

export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(auth.currentUser);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [claimsLoading, setClaimsLoading] = useState<boolean>(true); 

  useEffect(() => {
    const unsubscribe = auth.onIdTokenChanged(async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        setClaimsLoading(true);
        try {
          const idTokenResult = await fbUser.getIdTokenResult();
          if (idTokenResult.claims.admin === true) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        } catch (error) {
          console.error("Error fetching custom claims:", error);
          setIsAdmin(false); 
        } finally {
          setClaimsLoading(false);
        }
      } else {
        setIsAdmin(false);
        setClaimsLoading(false); 
      }
      setLoading(false); 
    });

    if (auth.currentUser) {
        auth.currentUser.getIdTokenResult().then(idTokenResult => {
            setIsAdmin(idTokenResult.claims.admin === true);
            setClaimsLoading(false);
        }).catch(err => {
            console.error("Initial claims check error:", err);
            setIsAdmin(false);
            setClaimsLoading(false);
        });
    } else {
        setClaimsLoading(false); 
    }


    return () => unsubscribe();
  }, []);

  return {
    user: firebaseUser,
    isAdmin, 
    isAuthenticated: !!firebaseUser,
    loading: loading || claimsLoading, 
  };
}